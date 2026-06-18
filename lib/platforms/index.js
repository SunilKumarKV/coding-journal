import * as leetcode from "./leetcode.js";
import * as codeforces from "./codeforces.js";
import * as codechef from "./codechef.js";
import * as hackerrank from "./hackerrank.js";

export const PLATFORM_ADAPTERS = {
  leetcode,
  codeforces,
  codechef,
  hackerrank
};

export function getPlatformAdapter(platformKey) {
  return PLATFORM_ADAPTERS[platformKey] ?? null;
}
