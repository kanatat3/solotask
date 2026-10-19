// Supabase จำลอง (ในหน้าเว็บ) — ฉีดเป็น window.supabase ก่อนแอปโหลด ทำให้ทดสอบ sync ได้โดยไม่แตะ cloud จริง
// ควบคุมจาก test ผ่าน window.__sb: { rows (app_state ต่อ user), delay (ms), failUpsert, upserts[], fetches[] }
export function mockSupabaseHead({ userId = "u-test", email = "tester@example.com", remote = null, delay = 0, noSession = false } = {}) {
  return `<script>
  (function () {
    const S = window.__sb = { noSession: ${noSession ? "true" : "false"}, rows: {}, delay: ${Number(delay)}, failUpsert: false, upserts: [], pulls: 0, fetches: [], agentLog: [] };
    if (${JSON.stringify(remote)} !== null) S.rows[${JSON.stringify(userId)}] = { data: ${JSON.stringify(remote)} };
    const wait = () => new Promise(r => setTimeout(r, S.delay));
    const session = { access_token: "tok-" + Date.now(), user: { id: ${JSON.stringify(userId)}, email: ${JSON.stringify(email)}, app_metadata: { provider: "email" }, user_metadata: {} } };
    // ตารางทั่วไป (Requests): select/eq/order/limit, insert, update().eq(), delete().eq() — เก็บใน window.__sb.tables[table]
    function generic(table) {
      S.tables = S.tables || {};
      const rows = () => (S.tables[table] = S.tables[table] || []);
      const q = { filters: [], op: "select", payload: null, order: null };
      const api = {
        select() { return api; },
        eq(k, v) { q.filters.push([k, v]); return api; },
        order(k, o) { q.order = [k, o && o.ascending === false ? -1 : 1]; return api; },
        limit() { return api; },
        insert(v) { q.op = "insert"; q.payload = v; return api; },
        update(v) { q.op = "update"; q.payload = v; return api; },
        delete() { q.op = "delete"; return api; },
        then(res, rej) {
          const match = (r) => q.filters.every(([k, v]) => r[k] === v);
          let out = { data: null, error: S.failTables ? { message: "mock table failure" } : null };
          if (!out.error) {
            if (q.op === "insert") { for (const r of [].concat(q.payload)) rows().push({ id: crypto.randomUUID(), created_at: new Date().toISOString(), ...JSON.parse(JSON.stringify(r)) }); }
            else if (q.op === "update") { rows().filter(match).forEach(r => Object.assign(r, q.payload)); }
            else if (q.op === "delete") { S.tables[table] = rows().filter(r => !match(r)); }
            else {
              let d = rows().filter(match).map(r => JSON.parse(JSON.stringify(r)));
              if (q.order) d.sort((a, b) => String(a[q.order[0]]).localeCompare(String(b[q.order[0]])) * q.order[1]);
              out.data = d;
            }
          }
          return Promise.resolve(out).then(res, rej);
        },
      };
      return api;
    }
    function query(table) {
      if (table === "request_links" || table === "project_requests" || table === "telegram_links" || table === "telegram_bot") return generic(table);
      const q = { table, filters: {}, _update: null };
      const api = {
        select() { return api; },
        eq(k, v) { q.filters[k] = v; return api; },
        order() { return api; }, limit() { return api; },
        in(k, ids) { if (q._update) { S.agentLog.forEach(r => { if (ids.includes(r.id)) Object.assign(r, q._update); }); } return Promise.resolve({ error: null }); },
        update(v) { q._update = v; return api; },
        async maybeSingle() { await wait(); S.pulls++; const row = S.rows[q.filters.user_id]; return { data: row ? { data: JSON.parse(JSON.stringify(row.data)) } : null, error: null }; },
        delete() { q._delete = true; return api; },
        async upsert(row) {
          await wait();
          if (table === "push_subscriptions") {   // RLS จำลอง: endpoint ของบัญชีอื่น -> error
            S.push = S.push || [];
            const other = S.push.find(p => p.endpoint === row.endpoint && p.user_id !== row.user_id);
            if (other) return { error: { message: "new row violates row-level security policy" } };
            S.push = S.push.filter(p => p.endpoint !== row.endpoint).concat([JSON.parse(JSON.stringify(row))]);
            return { error: null };
          }
          if (S.failUpsert) return { error: { message: "mock upsert failure" } };
          S.rows[row.user_id] = { data: JSON.parse(JSON.stringify(row.data)) };
          S.upserts.push(JSON.parse(JSON.stringify(row.data)));
          return { error: null };
        },
        then(res, rej) {   // select().eq().eq().order().limit() ของ agent_log
          if (q._delete && table === "push_subscriptions") {
            S.push = (S.push || []).filter(p => !Object.entries(q.filters).every(([k, v]) => p[k] === v));
            return Promise.resolve({ error: null }).then(res, rej);
          }
          return Promise.resolve({ data: table === "agent_log" ? S.agentLog.filter(r => !r.imported) : [], error: null }).then(res, rej);
        },
      };
      return api;
    }
    window.supabase = {
      createClient() {
        return {
          from: (t) => query(t),
          auth: {
            getSession: async () => ({ data: { session: S.noSession ? null : session } }),
            exchangeCodeForSession: async (code) => { S.exchanged = (S.exchanged || []).concat(code); return { data: { session }, error: null }; },
            onAuthStateChange: (cb) => { S.authCb = cb; return { data: { subscription: { unsubscribe() {} } } }; },
            signOut: async () => { await wait(); S.signedOut = true; if (S.authCb) S.authCb("SIGNED_OUT", null); return { error: null }; },
          },
          functions: { invoke: async () => ({ data: null, error: { message: "not deployed" } }) },
          // Storage จำลอง: เก็บ path/ชนิด/ขนาด ใน window.__sb.files; ลิงก์ชั่วคราวเป็นรูป PNG 1x1
          storage: { from: (bucket) => ({
            upload: async (path, blob, opts) => {
              await wait(); S.files = S.files || {};
              if (S.failStorage) return { error: { message: "mock storage failure" } };
              if (S.files[path]) return { error: { message: "The resource already exists" } };
              S.files[path] = { bucket, type: opts && opts.contentType, size: blob.size };
              return { data: { path }, error: null };
            },
            createSignedUrl: async (path) => (S.files || {})[path]
              ? { data: { signedUrl: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==" }, error: null }
              : { data: null, error: { message: "Object not found" } },
            remove: async (paths) => { S.files = S.files || {}; paths.forEach(x => delete S.files[x]); S.removed = (S.removed || []).concat(paths); return { data: [], error: null }; },
          }) },
        };
      },
    };
    // flushCloudSave ใช้ fetch ตรง (keepalive) — ดักไว้เก็บลง rows เหมือน upsert
    const realFetch = window.fetch.bind(window);
    window.fetch = async (url, opts = {}) => {
      if (String(url).includes("/rest/v1/app_state")) {
        S.fetches.push({ keepalive: !!opts.keepalive, size: (opts.body || "").length });
        if (opts.keepalive && (opts.body || "").length > 64000) throw new TypeError("keepalive body too large");
        await wait();
        if (S.failUpsert) return new Response("{}", { status: 500 });
        const body = JSON.parse(opts.body)[0];
        S.rows[body.user_id] = { data: body.data };
        S.upserts.push(body.data);
        return new Response("[]", { status: 201 });
      }
      return realFetch(url, opts);
    };
  })();
  </script>`;
}
