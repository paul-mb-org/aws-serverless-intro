import { useState, useEffect, useCallback } from "react";
import {
  CognitoUserPool,
  CognitoUser,
  AuthenticationDetails,
  CognitoUserAttribute,
  CognitoUserSession,
} from "amazon-cognito-identity-js";
import { config } from "../config";

const userPool = new CognitoUserPool({
  UserPoolId: config.cognito.userPoolId,
  ClientId: config.cognito.userPoolClientId,
});

export interface AuthState {
  isAuthenticated: boolean;
  user: CognitoUser | null;
  loading: boolean;
  error: string | null;
}

export interface AuthActions {
  signIn: (username: string, password: string) => Promise<void>;
  signUp: (username: string, password: string, name: string) => Promise<void>;
  signOut: () => void;
  confirmSignUp: (username: string, code: string) => Promise<void>;
}

export function useAuth(): AuthState & AuthActions {
  const [state, setState] = useState<AuthState>({
    isAuthenticated: false,
    user: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    const currentUser = userPool.getCurrentUser();
    if (currentUser) {
      currentUser.getSession((err: Error | null, session: CognitoUserSession | null) => {
        if (err || !session?.isValid()) {
          setState({ isAuthenticated: false, user: null, loading: false, error: null });
        } else {
          setState({ isAuthenticated: true, user: currentUser, loading: false, error: null });
        }
      });
    } else {
      setState({ isAuthenticated: false, user: null, loading: false, error: null });
    }
  }, []);

  const signIn = useCallback(async (username: string, password: string) => {
    setState((prev) => ({ ...prev, loading: true, error: null }));

    const authDetails = new AuthenticationDetails({
      Username: username,
      Password: password,
    });

    const cognitoUser = new CognitoUser({
      Username: username,
      Pool: userPool,
    });

    return new Promise<void>((resolve, reject) => {
      cognitoUser.authenticateUser(authDetails, {
        onSuccess: () => {
          setState({ isAuthenticated: true, user: cognitoUser, loading: false, error: null });
          resolve();
        },
        onFailure: (err) => {
          setState((prev) => ({ ...prev, loading: false, error: err.message }));
          reject(err);
        },
      });
    });
  }, []);

  const signUp = useCallback(async (username: string, password: string, name: string) => {
    setState((prev) => ({ ...prev, loading: true, error: null }));

    const attributes = [
      new CognitoUserAttribute({ Name: "name", Value: name }),
    ];

    return new Promise<void>((resolve, reject) => {
      userPool.signUp(username, password, attributes, [], (err) => {
        if (err) {
          setState((prev) => ({ ...prev, loading: false, error: err.message }));
          reject(err);
        } else {
          setState((prev) => ({ ...prev, loading: false }));
          resolve();
        }
      });
    });
  }, []);

  const confirmSignUp = useCallback(async (username: string, code: string) => {
    const cognitoUser = new CognitoUser({
      Username: username,
      Pool: userPool,
    });

    return new Promise<void>((resolve, reject) => {
      cognitoUser.confirmRegistration(code, true, (err) => {
        if (err) {
          setState((prev) => ({ ...prev, error: err.message }));
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }, []);

  const signOut = useCallback(() => {
    const currentUser = userPool.getCurrentUser();
    if (currentUser) {
      currentUser.signOut();
    }
    setState({ isAuthenticated: false, user: null, loading: false, error: null });
  }, []);

  return {
    ...state,
    signIn,
    signUp,
    signOut,
    confirmSignUp,
  };
}
