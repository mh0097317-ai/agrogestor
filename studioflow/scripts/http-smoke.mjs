import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
const base = process.env.SMOKE_URL || "http://localhost:3000";
let cookie = "",
  slug = "";
async function request(route, method = "GET", data, withCookie = false) {
  const response = await fetch(base + route, {
    method,
    headers: {
      "Content-Type": "application/json",
      Origin: base,
      ...(withCookie ? { Cookie: cookie } : {}),
    },
    ...(data ? { body: JSON.stringify(data) } : {}),
  });
  return { response, body: await response.json() };
}
try {
  const catalog = await request("/api/public/barber-011");
  assert.equal(catalog.response.status, 200);
  assert(!("customers" in catalog.body));
  assert(!("payments" in catalog.body));
  assert(!("paymentAccount" in catalog.body) && !("memberships" in catalog.body));
  assert(
    catalog.body.professionals.every(
      (p) => !("phone" in p) && !("commission" in p),
    ),
  );
  const setup = await request("/api/onboarding", "POST", {
    category: "Barbearia",
    name: "StudioFlow QA",
    cover: "",
    services: [{ name: "Corte de teste", duration: 60, price: 65 }],
    professionalNames: ["Profissional QA"],
    openDays: [0, 1, 2, 3, 4, 5, 6],
    openStart: "08:00",
    openEnd: "20:00",
  });
  assert.equal(setup.response.status, 201);
  slug = setup.body.slug;
  assert(slug.startsWith("studioflow-qa-"));
  cookie = setup.response.headers.get("set-cookie").split(";")[0];
  const workspace = await request("/api/workspace", "GET", undefined, true);
  assert.equal(workspace.body.business.slug, slug);
  assert.equal(workspace.body.appointments.length, 0);
  assert.notEqual(workspace.body.business.id, catalog.body.business.id);
  const date = new Date(Date.now() + 2 * 86400000).toLocaleDateString("en-CA", {
    timeZone: "America/Sao_Paulo",
  });
  const serviceId = workspace.body.services[0].id;
  const professionalId = workspace.body.professionals[0].id;
  const slots = await request(
    `/api/public/${slug}/slots?serviceId=${serviceId}&professionalId=${professionalId}&date=${date}`,
  );
  assert(slots.body.length > 3);
  const slot = slots.body[0];
  const booking = {
    serviceIds: [serviceId],
    professionalId,
    start: slot.start,
    name: "Cliente QA",
    phone: "11999999991",
    reminder: false,
  };
  const attempts = await Promise.all([
    request(`/api/public/${slug}/book`, "POST", booking),
    request(`/api/public/${slug}/book`, "POST", {
      ...booking,
      phone: "11999999992",
    }),
  ]);
  assert.deepEqual(attempts.map((r) => r.response.status).sort(), [201, 409]);
  const appointment = attempts.find((r) => r.response.status === 201).body;
  assert.equal(appointment.token.length, 64);
  const receipt = await request(`/api/booking/${appointment.token}`);
  assert.equal(receipt.body.appointment.id, appointment.id);
  assert(!("commission" in receipt.body.professional));
  const foreign = await request(
    "/api/workspace",
    "POST",
    {
      entity: "services",
      action: "update",
      data: { id: serviceId, businessId: catalog.body.business.id },
    },
    true,
  );
  assert.equal(foreign.response.status, 403);
  const incompletePayment = await request(
    "/api/workspace",
    "POST",
    {
      entity: "payments",
      action: "create",
      data: { appointmentId: appointment.id, amount: 30, method: "pix" },
    },
    true,
  );
  assert(!incompletePayment.response.ok);
  const rescheduled = await request(
    `/api/booking/${appointment.token}`,
    "PATCH",
    { action: "reschedule", start: slots.body[3].start },
  );
  assert.equal(rescheduled.response.status, 200);
  const cancel = await request(`/api/booking/${appointment.token}`, "PATCH", {
    action: "cancel",
  });
  assert.equal(cancel.body.status, "cancelled");
  const final = await request("/api/workspace", "GET", undefined, true);
  assert.equal(final.body.appointments[0].status, "cancelled");
  assert.equal(final.body.customers.length, 1);
  assert.equal(final.body.payments.length, 0);
  const serviceEdit = await request(
    "/api/workspace",
    "POST",
    {
      entity: "services",
      action: "update",
      data: {
        id: serviceId,
        description: "Serviço revisado no teste isolado.",
      },
    },
    true,
  );
  assert.equal(serviceEdit.response.status, 200);
  assert.equal(
    serviceEdit.body.services[0].description,
    "Serviço revisado no teste isolado.",
  );
  const secondBooking = await request(`/api/public/${slug}/book`, "POST", {
    ...booking,
    name: "Cliente pagamento QA",
    phone: "11999999993",
  });
  assert.equal(secondBooking.response.status, 201);
  for (const status of ["in_progress", "completed"]) {
    const update = await request(
      "/api/workspace",
      "POST",
      {
        entity: "appointments",
        action: "update",
        data: { id: secondBooking.body.id, status },
      },
      true,
    );
    assert.equal(update.response.status, 200);
    assert.equal(
      update.body.appointments.find((item) => item.id === secondBooking.body.id)
        .status,
      status,
    );
  }
  for (const [amount, method] of [
    [30, "pix"],
    [35, "cash"],
  ]) {
    const payment = await request(
      "/api/workspace",
      "POST",
      {
        entity: "payments",
        action: "create",
        data: { appointmentId: secondBooking.body.id, amount, method },
      },
      true,
    );
    assert.equal(payment.response.status, 200);
  }
  const overpayment = await request(
    "/api/workspace",
    "POST",
    {
      entity: "payments",
      action: "create",
      data: { appointmentId: secondBooking.body.id, amount: 1, method: "pix" },
    },
    true,
  );
  assert(!overpayment.response.ok);
  const paidWorkspace = await request("/api/workspace", "GET", undefined, true);
  assert.equal(
    paidWorkspace.body.payments.reduce(
      (sum, payment) => sum + payment.amount,
      0,
    ),
    65,
  );
  // Platform access: pausing closes the panel and the online booking.
  const businessId = paidWorkspace.body.business.id;
  const pause = await request("/api/admin/platform", "POST", {
    businessId,
    action: "suspended",
  });
  assert.equal(pause.response.status, 200);
  const closed = await request("/api/workspace", "GET", undefined, true);
  assert.equal(closed.response.status, 423);
  assert.equal(closed.body.access.state, "suspended");
  assert(!("appointments" in closed.body));
  assert.equal((await request(`/api/public/${slug}`)).response.status, 423);
  const reopen = await request("/api/admin/platform", "POST", {
    businessId,
    action: "granted",
    days: 30,
  });
  assert.equal(reopen.response.status, 200);
  const opened = await request("/api/workspace", "GET", undefined, true);
  assert.equal(opened.response.status, 200);
  assert.equal(opened.body.access.state, "active");
  assert.equal((await request(`/api/public/${slug}`)).response.status, 200);
  // Modules: a plan without products blocks them on the server too.
  const essential = await request("/api/admin/platform", "PUT", {
    businessId,
    plan: "Essencial",
    price: 79.9,
    modules: ["fidelidade", "espera"],
  });
  assert.equal(essential.response.status, 200);
  const blockedProduct = await request(
    "/api/workspace/products",
    "POST",
    { name: "Pomada QA", price: 30, stock: 5 },
    true,
  );
  assert.equal(blockedProduct.response.status, 403);
  const limited = await request("/api/workspace", "GET", undefined, true);
  assert.deepEqual(limited.body.access.modules, ["espera", "fidelidade"]);
  const premium = await request("/api/admin/platform", "PUT", {
    businessId,
    plan: "Premium",
    price: 149.9,
    modules: ["pagamentos", "clube", "recepcionista", "produtos", "recepcao", "fidelidade", "espera"],
  });
  assert.equal(premium.response.status, 200);
  const product = await request(
    "/api/workspace/products",
    "POST",
    { name: "Pomada QA", price: 30, stock: 5 },
    true,
  );
  assert.equal(product.response.status, 200);
  const original = await request("/api/workspace");
  assert.equal(original.body.business.slug, "barber-011");
  console.log(
    "HTTP smoke PASS: isolated onboarding, public projection, tenant isolation, concurrent booking, token receipt, service editing, attendance actions, partial payments, overpayment rejection, reschedule, cancellation, platform access and plan modules.",
  );
} finally {
  if (slug && /^studioflow-qa-[a-f0-9]{6}$/.test(slug)) {
    const directory = path.resolve(".data");
    const filename = path.resolve(directory, `business-${slug}.json`);
    assert(filename.startsWith(directory + path.sep));
    await fs.rm(filename, { force: true });
  }
}
