import fs from "node:fs";
import crypto from "node:crypto";
import vm from "node:vm";

// Apply only to the inspected 2.3.7 bundle; refuse an unknown provider build.
const originalHash =
  "71b49ea87b8d0d7b413b77d067e33a8720c2e95e136f632210c1424862ef6b44";
const patchedHash =
  "8ee32c18698ffe1df42f21b9eaab3167800e16b31ce3b5131792d964055a08aa";
const target = process.argv[2] || "/evolution/dist/main.js";
const source = fs.readFileSync(target, "utf8");
const hash = (value) => crypto.createHash("sha256").update(value).digest("hex");
if (hash(source) !== originalHash && hash(source) !== patchedHash)
  throw Error("Unknown Evolution build; patch refused");
const oldList =
  "async listMessage(e){return await this.sendMessageWithTyping(e.number,{listMessage:{title:e.title,description:e.description,buttonText:e?.buttonText,footerText:e?.footerText,sections:e.sections,listType:2}}";
const entry =
  "async sendMessage(e,t,o,i,n,r,a,c){e=e.toLowerCase();let l={quoted:n};";
const listBranch =
  'if(t.listMessage){const sfMessage=R.proto.Message.fromObject({listMessage:{...t.listMessage,listType:1}});const sfEnvelope=(0,R.generateWAMessageFromContent)(e,sfMessage,{userJid:this.instance.wuid,...l});await this.client.relayMessage(e,sfEnvelope.message,{messageId:sfEnvelope.key.id,additionalNodes:[{tag:"biz",attrs:{},content:[{tag:"list",attrs:{type:"product_list",v:"2"}}]}]});return sfEnvelope;}';
let patched = source;
if (hash(source) === originalHash) {
  for (const needle of [oldList, entry])
    if (source.split(needle).length !== 2)
      throw Error("Unexpected method boundaries");
  patched = source
    .replace(oldList, oldList.replace("listType:2", "listType:1"))
    .replace(entry, entry + listBranch);
}
new vm.Script(patched, { filename: target });
if (hash(patched) !== patchedHash) throw Error("Unexpected patch output");
fs.writeFileSync(target, patched);
// Exercise the actual patched method with installed Baileys and a network-free client.
const start = patched.indexOf(entry);
const end = patched.indexOf("async sendMessageWithTyping(", start);
if (start < 0 || end < 0) throw Error("Missing regression-test method");
fs.writeFileSync(
  "/tmp/studioflow-native-method.cjs",
  "module.exports=function(R,X){return ({" +
    patched.slice(start, end) +
    "}).sendMessage;}",
);
console.log("Evolution native-list patch verified: " + patchedHash);
