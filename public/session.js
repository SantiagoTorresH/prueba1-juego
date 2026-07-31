(function () {
  const TOKEN_KEY = 'token';
  const USER_KEY = 'user';

  function getStorage(preferSession) {
    try {
      return preferSession ? window.sessionStorage : window.localStorage;
    } catch (error) {
      return null;
    }
  }

  function getStoredTokenInfo() {
    const localStorageRef = getStorage(false);
    const sessionStorageRef = getStorage(true);
    const localToken = readToken(localStorageRef);
    if (localToken) {
      return { token: localToken, type: 'local', storage: localStorageRef };
    }

    return { token: readToken(sessionStorageRef), type: 'session', storage: sessionStorageRef };
  }

  function getStoredToken() {
    return getStoredTokenInfo().token;
  }

  function readToken(storage) {
    if (!storage) {
      return null;
    }

    return storage.getItem(TOKEN_KEY);
  }

  function storeToken(token, rememberMe) {
    const persistentStorage = getStorage(false);
    const sessionStorageRef = getStorage(true);

    if (!persistentStorage || !sessionStorageRef) {
      return;
    }

    if (rememberMe) {
      persistentStorage.setItem(TOKEN_KEY, token);
      sessionStorageRef.removeItem(TOKEN_KEY);
    } else {
      sessionStorageRef.setItem(TOKEN_KEY, token);
      persistentStorage.removeItem(TOKEN_KEY);
    }
  }

  function getStoredUser() {
    const localStorageRef = getStorage(false);
    const sessionStorageRef = getStorage(true);
    const localUser = readUser(localStorageRef);
    if (localUser) {
      return localUser;
    }
    return readUser(sessionStorageRef);
  }

  function readUser(storage) {
    if (!storage) {
      return null;
    }

    const stored = storage.getItem(USER_KEY);
    if (!stored) {
      return null;
    }

    try {
      return JSON.parse(stored);
    } catch (error) {
      return null;
    }
  }

  function storeUser(user, rememberMe) {
    const persistentStorage = getStorage(false);
    const sessionStorageRef = getStorage(true);

    if (!persistentStorage || !sessionStorageRef) {
      return;
    }

    if (rememberMe) {
      persistentStorage.setItem(USER_KEY, JSON.stringify(user));
      sessionStorageRef.removeItem(USER_KEY);
    } else {
      sessionStorageRef.setItem(USER_KEY, JSON.stringify(user));
      persistentStorage.removeItem(USER_KEY);
    }
  }

  function clearAuthState() {
    const localStorageRef = getStorage(false);
    const sessionStorageRef = getStorage(true);

    [localStorageRef, sessionStorageRef].forEach((storage) => {
      if (!storage) {
        return;
      }

      storage.removeItem(TOKEN_KEY);
      storage.removeItem(USER_KEY);
    });
  }

  function getSessionStatus() {
    const token = getStoredToken();
    if (!token) {
      return 'sin-sesion';
    }

    if (navigator.onLine === false) {
      return 'sin-conexion';
    }

    return 'conectado';
  }

  function updateSessionStatus(statusEl) {
    if (!statusEl) {
      return;
    }

    const status = getSessionStatus();
    statusEl.textContent = status === 'conectado' ? 'Conectado' : status === 'sin-conexion' ? 'Sin conexión' : 'Sesión expirada';
    statusEl.className = `status-chip status-${status}`;
  }

  async function validateStoredSession({ redirectTo = '/auth.html' } = {}) {
    const tokenInfo = getStoredTokenInfo();
    const token = tokenInfo.token;

    if (!token) {
      clearAuthState();
      if (redirectTo) {
        window.location.replace(redirectTo);
      }
      return null;
    }

    try {
      const response = await fetch('/api/me', {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!response.ok) {
        throw new Error('Sesión inválida');
      }

      const data = await response.json();
      if (data?.user) {
        storeUser(data.user, tokenInfo.type === 'local');
      }

      return data?.user || null;
    } catch (error) {
      clearAuthState();
      if (redirectTo) {
        window.location.replace(redirectTo);
      }
      return null;
    }
  }

  window.authSession = {
    getStoredToken,
    getStoredTokenInfo,
    getStoredUser,
    storeToken,
    storeUser,
    clearAuthState,
    getSessionStatus,
    updateSessionStatus,
    validateStoredSession
  };
})();
