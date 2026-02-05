import { useCallback, useEffect, useRef, useState } from "react";
import { Amplify } from "aws-amplify";
import type { ResourcesConfig } from "aws-amplify";
import { fetchAuthSession } from "aws-amplify/auth";
import { PubSub } from "@aws-amplify/pubsub";
import { config } from "../config";
import type { IoTNotification } from "../types";

// Amplify configuration - lazy initialized
let isConfigured = false;
let pubsubInstance: PubSub | null = null;

function getAmplifyConfig(): ResourcesConfig {
  return {
    Auth: {
      Cognito: {
        identityPoolId: config.cognito.identityPoolId,
        userPoolId: config.cognito.userPoolId,
        userPoolClientId: config.cognito.userPoolClientId,
        allowGuestAccess: true,
      },
    },
  };
}

function ensureAmplifyConfigured() {
  if (isConfigured) return;

  console.log("[IoT] Configuring Amplify with:", {
    region: config.region,
    identityPoolId: config.cognito.identityPoolId,
    iotEndpoint: config.iotEndpoint,
  });

  Amplify.configure(getAmplifyConfig());
  isConfigured = true;
}

function getPubSubInstance(): PubSub {
  if (pubsubInstance) return pubsubInstance;

  ensureAmplifyConfigured();

  console.log("[IoT] Creating PubSub instance with endpoint:", `wss://${config.iotEndpoint}/mqtt`);

  pubsubInstance = new PubSub({
    region: config.region,
    endpoint: `wss://${config.iotEndpoint}/mqtt`,
  });

  return pubsubInstance;
}

export function useIoT(
  topic: string,
  onMessage: (msg: IoTNotification) => void
): { connected: boolean; error: Error | null; disconnect: () => void } {
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const subscriptionRef = useRef<{ unsubscribe: () => void } | null>(null);
  const onMessageRef = useRef(onMessage);
  const connectedRef = useRef(false);

  useEffect(() => {
    onMessageRef.current = onMessage;
  }, [onMessage]);

  const disconnect = useCallback(() => {
    console.log("[IoT] Disconnecting...");
    if (subscriptionRef.current) {
      subscriptionRef.current.unsubscribe();
      subscriptionRef.current = null;
    }
    connectedRef.current = false;
    setConnected(false);
  }, []);

  useEffect(() => {
    if (!topic) {
      console.log("[IoT] No topic provided");
      return;
    }

    if (!config.iotEndpoint || !config.cognito.identityPoolId) {
      console.log("[IoT] Missing config:", {
        iotEndpoint: config.iotEndpoint,
        identityPoolId: config.cognito.identityPoolId,
      });
      setError(new Error("Missing IoT configuration"));
      return;
    }

    let isCancelled = false;

    async function connect() {
      try {
        console.log("[IoT] Starting connection process...");

        // Ensure Amplify is configured
        ensureAmplifyConfigured();

        // Fetch credentials first to ensure we have valid auth
        console.log("[IoT] Fetching auth session...");
        const session = await fetchAuthSession();

        if (!session.credentials) {
          throw new Error("No AWS credentials available");
        }

        console.log("[IoT] Got credentials:", {
          accessKeyId: session.credentials.accessKeyId?.slice(0, 8) + "...",
          identityId: session.identityId,
        });

        if (isCancelled) {
          console.log("cancelled");
          return;
        }

        // Get PubSub instance
        const pubsub = getPubSubInstance();

        console.log("[IoT] Subscribing to topic:", topic);

        // Subscribe to the topic
        const sub = pubsub.subscribe({ topics: [topic] }).subscribe({
          next: (data: unknown) => {
            if (isCancelled) return;

            // Mark as connected on first message
            if (!connectedRef.current) {
              connectedRef.current = true;
              setConnected(true);
              setError(null);
            }

            console.log("[IoT] Message received:", data);

            // Handle message format variations
            let payload: IoTNotification;
            if (typeof data === "object" && data !== null) {
              const dataObj = data as Record<string, unknown>;
              if ("value" in dataObj && dataObj.value) {
                payload = dataObj.value as IoTNotification;
              } else {
                payload = data as IoTNotification;
              }
            } else {
              console.warn("[IoT] Unexpected message format:", data);
              return;
            }

            onMessageRef.current(payload);
          },
          error: (err: Error) => {
            console.error("[IoT] Subscription error:", err);
            if (!isCancelled) {
              setError(err);
              connectedRef.current = false;
              setConnected(false);
            }
          },
          complete: () => {
            console.log("[IoT] Subscription completed");
            if (!isCancelled) {
              connectedRef.current = false;
              setConnected(false);
            }
          },
        });

        subscriptionRef.current = sub;

        // Mark as connected after successful subscription setup
        // Real connection confirmed when first message arrives or subscription doesn't error
        setTimeout(() => {
          if (!isCancelled && !connectedRef.current) {
            connectedRef.current = true;
            setConnected(true);
            setError(null);
            console.log("[IoT] Assumed connected to topic:", topic);
          }
        }, 2000);

        console.log("[IoT] Subscription set up for topic:", topic);
      } catch (err) {
        console.error("[IoT] Failed to connect:", err);
        if (!isCancelled) {
          setError(err instanceof Error ? err : new Error(String(err)));
        }
      }
    }

    connect();

    return () => {
      console.log("[IoT] Cleanup - cancelling subscription");
      isCancelled = true;
      disconnect();
    };
  }, [topic, disconnect]);

  return { connected, error, disconnect };
}
