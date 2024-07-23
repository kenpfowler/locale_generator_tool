import { describe, expect, it } from "@jest/globals";

function addNumbers(arg1: number, arg2: number) {
  return arg1 + arg2;
}

describe("addNumbers function", () => {
  it("should add two numbers correctly", () => {
    expect(addNumbers(1, 2)).toBe(3);
  });
});
