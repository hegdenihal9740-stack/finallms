import { describe, expect, it } from "vitest";
import { feedbackError } from "../campusly/feedbackRules";

describe("feedback validation", () => {
  it("accepts course-specific feedback", () => {
    expect(
      feedbackError({
        module: "3",
        rating: 4,
        message: "More practical examples please.",
      }),
    ).toBe("");
  });
  it("requires a module, rating, and comment", () => {
    expect(feedbackError({ module: "", rating: 4, message: "Useful" })).toBe(
      "Please select a module.",
    );
    expect(feedbackError({ module: "3", rating: 0, message: "Useful" })).toBe(
      "Please choose a rating from 1 to 5.",
    );
    expect(feedbackError({ module: "3", rating: 4, message: " " })).toBe(
      "Please enter your comments.",
    );
  });
});
