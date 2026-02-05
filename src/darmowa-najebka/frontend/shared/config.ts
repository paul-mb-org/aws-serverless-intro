export const config = {
  region: import.meta.env.VITE_AWS_REGION || "eu-central-1",
  customerApiUrl: import.meta.env.VITE_CUSTOMER_API_URL || "",
  barmanApiUrl: import.meta.env.VITE_BARMAN_API_URL || "",
  iotEndpoint: import.meta.env.VITE_IOT_ENDPOINT || "",
  cognito: {
    userPoolId: import.meta.env.VITE_USER_POOL_ID || "",
    userPoolClientId: import.meta.env.VITE_USER_POOL_CLIENT_ID || "",
    identityPoolId: import.meta.env.VITE_IDENTITY_POOL_ID || "",
  },
  mobileAppUrl: import.meta.env.VITE_MOBILE_APP_URL || "http://localhost:5173",
};
