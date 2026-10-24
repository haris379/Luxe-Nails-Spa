import { test } from "node:test";
import assert from "node:assert/strict";

process.env.MAIL_FROM = '"Luxe Nails Website <sender@example.com>"'.replace(
  /^"|"$/g,
  "",
);
process.env.OWNER_EMAIL = "owner@example.com";
const { buildContactEmail, parseMailFrom } =
  await import("../src/utils/mailer.js");

test("parseMailFrom handles named and bare addresses", () => {
  assert.deepEqual(parseMailFrom("Luxe Nails Website <a@b.com>"), {
    name: "Luxe Nails Website",
    address: "a@b.com",
  });
  assert.deepEqual(parseMailFrom('"Luxe, Nails" <a@b.com>'), {
    name: "Luxe, Nails",
    address: "a@b.com",
  });
  assert.deepEqual(parseMailFrom("a@b.com"), { name: "", address: "a@b.com" });
  assert.equal(parseMailFrom("garbage"), null);
});

test("contact email: From address stays ours, Reply-To is the visitor, recipient unchanged", () => {
  const m = buildContactEmail({
    name: "Muhammad Haris",
    email: "visitor@example.org",
    subject: "Hi",
    message: "Hello there",
  });
  assert.equal(m.from.address, "sender@example.com");
  assert.equal(m.from.name, "Muhammad Haris via Luxe Nails Website");
  assert.equal(m.replyTo.address, "visitor@example.org");
  assert.equal(m.to, "owner@example.com");
  assert.ok(m.text.includes("Muhammad Haris <visitor@example.org>"));
  assert.ok(m.html.includes("visitor@example.org"));
});

test("contact email: hostile visitor names cannot spoof an address or inject headers", () => {
  const m = buildContactEmail({
    name: "ceo@bank.com <x>\r\nBcc: a@b.c",
    email: "v@example.org",
    subject: "s",
    message: "m",
  });
  assert.ok(!/[@<>\r\n"]/.test(m.from.name));
  assert.equal(m.from.address, "sender@example.com");
});
