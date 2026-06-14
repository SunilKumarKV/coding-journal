export default async function sleep(millis, mode) {
  const promise = new Promise((resolve) => {
    setTimeout(resolve, millis);
  });

  if (mode !== "measure") {
    return promise;
  }

  const start = Date.now();
  await promise;
  return Date.now() - start >= millis;
}
