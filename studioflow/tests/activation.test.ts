import { test } from "node:test";
import assert from "node:assert/strict";
import { activationSignature, activationSteps } from "../src/lib/activation";
import { createSeed } from "../src/lib/seed";

test("activation never accepts an unlinked service or mismatched schedules", () => {
  const data = createSeed();
  const service = data.services[0];
  data.services = [{ ...service, active: true, professionalIds: [] }];
  assert.equal(activationSteps(data)[1].ready, false);
  data.services[0].professionalIds = [data.professionals[0].id];
  data.professionals[0].active = true;
  data.settings.openDays = [1];
  data.professionals[0].days = [2];
  assert.equal(activationSteps(data)[2].ready, false);
  data.professionals[0].days = [1];
  data.settings.openStart = "09:00";
  data.settings.openEnd = "19:00";
  data.professionals[0].start = "09:00";
  data.professionals[0].end = "18:00";
  data.professionals[0].breakStart = "";
  data.professionals[0].breakEnd = "";
  assert.equal(activationSteps(data)[2].ready, true);
  data.services[0].duration = 0;
  assert.equal(activationSteps(data)[0].ready, false);
});

test("activation requires connected WhatsApp and enabled AI; changing settings invalidates acknowledgement", () => {
  const data = createSeed();
  data.access = { ...data.access!, modules: ["recepcionista"] };
  data.whatsapp = null;
  data.whatsappLink = null;
  data.professionalWhatsAppLinks = [];
  data.aiReady = true;
  data.settings.assistantEnabled = true;
  assert.equal(activationSteps(data)[3].ready, false);
  data.whatsappLink = { status: "open", phone: "", profileName: "" };
  assert.equal(activationSteps(data)[3].ready, true);
  const signature = activationSignature(data);
  data.settings.assistantEnabled = false;
  assert.equal(activationSteps(data)[3].ready, false);
  assert.notEqual(activationSignature(data), signature);
  assert.equal(
    activationSteps(data).length,
    4,
    "test delivery always requires explicit owner review",
  );
});
