import { vi } from 'vitest';

// ---------------------------------------------------------------------------
// 1. Never talk to the real Supabase project from tests.
//
// Every query goes to a scriptable fake. By default it answers with an error
// ("offline"), so a test that forgets to script a call fails loudly instead of
// reaching the live database. Tests script answers through `supabaseMock`:
//
//   supabaseMock.onQuery = ({ table, method }) => ({ data: [...], error: null });
//   supabaseMock.auth.signIn = async () => ({ data: { user, session }, error: null });
// ---------------------------------------------------------------------------
type QueryCall = { table: string; method: string; args: unknown[]; calls: { method: string; args: unknown[] }[] };
type QueryResult = { data: any; error: any; count?: number | null };

const OFFLINE: QueryResult = { data: null, error: { message: 'Supabase is disabled in tests' }, count: null };

export const supabaseMock = {
  /** Every query issued, in order: table, the terminal operation, and the whole call chain. */
  queries: [] as QueryCall[],
  onQuery: null as null | ((call: QueryCall) => QueryResult | undefined),
  auth: {
    session: null as any,
    signIn: null as null | ((credentials: any) => Promise<any>),
    signUp: null as null | ((input: any) => Promise<any>),
    signOutCalls: 0,
  },
  functionsInvoked: [] as { name: string; options: any }[],
  onInvoke: null as null | ((name: string, options: any) => any),
  reset() {
    this.queries = [];
    this.onQuery = null;
    this.auth.session = null;
    this.auth.signIn = null;
    this.auth.signUp = null;
    this.auth.signOutCalls = 0;
    this.functionsInvoked = [];
    this.onInvoke = null;
  },
};

vi.mock('../utils/supabaseClient', () => {
  // A builder where every method returns the builder itself and awaiting it
  // resolves to the scripted result, mirroring supabase-js's thenable builders.
  const makeBuilder = (table: string) => {
    const calls: { method: string; args: unknown[] }[] = [];
    const builder: any = new Proxy(function () {}, {
      get(_target, prop: string) {
        if (prop === 'then') {
          return (resolve: (value: QueryResult) => unknown, reject?: (reason: unknown) => unknown) => {
            // The operation is the first of insert/update/delete/select in the chain.
            const operation = calls.find(c => ['insert', 'update', 'delete', 'upsert'].includes(c.method)) || calls[0];
            const call: QueryCall = { table, method: operation?.method || 'select', args: operation?.args || [], calls };
            supabaseMock.queries.push(call);
            const result = supabaseMock.onQuery?.(call) ?? OFFLINE;
            return Promise.resolve(result).then(resolve, reject);
          };
        }
        return (...args: unknown[]) => {
          calls.push({ method: prop, args });
          return builder;
        };
      },
    });
    return builder;
  };

  const supabase = {
    from: (table: string) => makeBuilder(table),
    rpc: (name: string) => makeBuilder(`rpc:${name}`),
    auth: {
      signInWithPassword: async (credentials: any) =>
        supabaseMock.auth.signIn
          ? supabaseMock.auth.signIn(credentials)
          : { data: { user: null, session: null }, error: { message: 'Invalid login credentials' } },
      signUp: async (input: any) =>
        supabaseMock.auth.signUp
          ? supabaseMock.auth.signUp(input)
          : { data: { user: null, session: null }, error: { message: 'Supabase is disabled in tests' } },
      signOut: async () => {
        supabaseMock.auth.signOutCalls += 1;
        supabaseMock.auth.session = null;
        return { error: null };
      },
      getSession: async () => ({ data: { session: supabaseMock.auth.session }, error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
    },
    functions: {
      invoke: async (name: string, options: any) => {
        supabaseMock.functionsInvoked.push({ name, options });
        return supabaseMock.onInvoke?.(name, options) ?? { data: null, error: { message: 'Supabase is disabled in tests' } };
      },
    },
  };

  return { supabase };
});

// ---------------------------------------------------------------------------
// 2. Web Storage.
//
// Newer Node versions define their own global `localStorage` (unusable without
// --localstorage-file), which shadows the one from happy-dom. Install a plain
// in-memory implementation so the tests behave the same on every Node version.
// ---------------------------------------------------------------------------
class MemoryStorage implements Storage {
  private store = new Map<string, string>();
  get length() { return this.store.size; }
  clear() { this.store.clear(); }
  getItem(key: string) { return this.store.has(key) ? this.store.get(key)! : null; }
  key(index: number) { return Array.from(this.store.keys())[index] ?? null; }
  removeItem(key: string) { this.store.delete(key); }
  setItem(key: string, value: string) { this.store.set(key, String(value)); }
}

for (const name of ['localStorage', 'sessionStorage'] as const) {
  const storage = new MemoryStorage();
  Object.defineProperty(globalThis, name, { value: storage, configurable: true, writable: true });
  if (typeof window !== 'undefined') {
    Object.defineProperty(window, name, { value: storage, configurable: true, writable: true });
  }
}
