import { describe, expect, it } from "vitest";
import { contactActions, smsHref } from "./contactActions";

describe("contactActions (audit A01)", () => {
  it("text-only lines never become a phone call", () => {
    const ctl = contactActions("Text HOME to 741741");
    expect(ctl.call).toBeUndefined();
    expect(ctl.text).toEqual({ number: "741741", keyword: "HOME", label: "Text HOME to 741741" });
    const safePlace = contactActions("Text SAFE and your location to 44357");
    expect(safePlace.call).toBeUndefined();
    expect(safePlace.text?.number).toBe("44357");
    expect(safePlace.text?.keyword).toBe("SAFE");
  });
  it("separates a call and a text in one string", () => {
    const mixed = contactActions("Call 211 or text HOPE to 20121");
    expect(mixed.call).toEqual({ number: "211", label: "Call 211" });
    expect(mixed.text).toEqual({ number: "20121", keyword: "HOPE", label: "Text HOPE to 20121" });
  });
  it("handles ordinary numbers and short lines", () => {
    expect(contactActions("925-655-1208").call).toEqual({ number: "9256551208", label: "Call 925-655-1208" });
    expect(contactActions("(510) 555-0100 ext 2").call?.number).toBe("5105550100");
    expect(contactActions("988").call?.number).toBe("988");
    expect(contactActions("").call).toBeUndefined();
    expect(contactActions("Request online telephone text or email assistance through the California Kinship Navigator")).toEqual({});
  });
  it("builds sms links with a keyword", () => {
    expect(smsHref("741741", "HOME")).toBe("sms:741741?&body=HOME");
    expect(smsHref("988")).toBe("sms:988");
  });
});
