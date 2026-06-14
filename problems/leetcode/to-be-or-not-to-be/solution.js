export default function expect(val, assertions) {
  const api = {
    toBe(other) {
      if (val === other) {
        return true;
      }

      throw new Error("Not Equal");
    },
    notToBe(other) {
      if (val !== other) {
        return true;
      }

      throw new Error("Equal");
    }
  };

  if (!Array.isArray(assertions)) {
    return api;
  }

  return assertions.map(({ method, arg }) => {
    try {
      return api[method](arg);
    } catch (error) {
      return error.message;
    }
  });
}
