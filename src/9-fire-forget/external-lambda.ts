export const handler = async (event: any) => {
  const { consent } = JSON.parse(event.body);

  if (consent === true) {
    return {
      statusCode: 200,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ message: "OK" }),
    };
  }

  return {
    statusCode: 500,
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ message: "Consent is false" }),
  };
};
