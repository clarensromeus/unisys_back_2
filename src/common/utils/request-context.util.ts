import { AsyncLocalStorage } from 'node:async_hooks';

export type RequestContextUser = {
  id: string;
  email: string;
  role: string;
  organizationId: string;
};

const storage = new AsyncLocalStorage<{ user?: RequestContextUser }>();

export function runWithRequestUser<T>(user: RequestContextUser | undefined, callback: () => T) {
  return storage.run({ user }, callback);
}

export function currentRequestUser() {
  return storage.getStore()?.user;
}
