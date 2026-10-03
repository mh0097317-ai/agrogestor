import test from "node:test";
import assert from "node:assert/strict";
import { createSeed } from "../src/lib/seed";
import { overviewModel } from "../src/features/dashboard/overview-model";
import { canMutateEntity } from "../src/lib/permissions";

test("painel prioriza atendimento em andamento e ignora horários já encerrados", () => {
  const store = createSeed();
  const base = store.appointments[0];
  store.appointments = [
    {...base, id:"past", start:"2026-10-02T09:00:00-03:00", end:"2026-10-02T09:40:00-03:00", status:"confirmed"},
    {...base, id:"future", start:"2026-10-02T14:00:00-03:00", end:"2026-10-02T14:40:00-03:00", status:"confirmed"},
    {...base, id:"active", start:"2026-10-02T10:00:00-03:00", end:"2026-10-02T10:40:00-03:00", status:"in_progress"},
  ];
  const now = Date.parse("2026-10-02T12:00:00-03:00");
  assert.equal(overviewModel(store,"2026-10-02",now).next?.id,"active");
  store.appointments = store.appointments.filter(a=>a.id!=="active");
  assert.equal(overviewModel(store,"2026-10-02",now).next?.id,"future");
  store.appointments = store.appointments.filter(a=>a.id==="past");
  assert.equal(overviewModel(store,"2026-10-02",now).next,undefined);
});
test("painel separa receita prevista de recebimentos e exclui faltas do ticket", () => {
  const store = createSeed();
  const base = store.appointments[0];
  store.appointments = [{...base,id:"done",price:65,start:"2026-10-02T09:00:00-03:00",end:"2026-10-02T10:00:00-03:00",status:"completed"},{...base,id:"missed",price:45,start:"2026-10-02T10:00:00-03:00",end:"2026-10-02T10:40:00-03:00",status:"no_show"}];
  store.payments = [{id:"partial",businessId:store.business.id,appointmentId:"done",amount:25,method:"pix",createdAt:"2026-10-02T02:30:00Z"}];
  const model = overviewModel(store,"2026-10-02",Date.parse("2026-10-02T12:00:00-03:00"));
  assert.equal(model.revenue,65);
  assert.equal(model.ticket,65);
  assert.equal(model.collected,0);
});
test("controles de gestão seguem os papéis autorizados pelo servidor", () => {
  for(const role of ["owner","admin","manager"]) assert.equal(canMutateEntity(role,"payments"),true);
  for(const entity of ["services","professionals","business","settings","payments"]) assert.equal(canMutateEntity("staff",entity),false);
  assert.equal(canMutateEntity("staff","appointments"),true);
  assert.equal(canMutateEntity("staff","customers"),true);
  assert.equal(canMutateEntity(undefined,"appointments"),false);
});
