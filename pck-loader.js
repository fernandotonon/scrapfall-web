// Scrapfall web shell helper: GitHub Pages rejects files over 100 MB, so CI splits index.pck into
// parts (index.pck.parts.json lists them). This wraps fetch() so Godot's loader receives the parts
// stitched back into one streamed response, with progress reporting intact.
(function () {
  const realFetch = window.fetch.bind(window);
  let manifest = null;
  async function getManifest() {
    if (manifest === null) {
      const r = await realFetch('index.pck.parts.json');
      manifest = r.ok ? await r.json() : false;
    }
    return manifest;
  }
  window.fetch = async function (input, init) {
    const url = typeof input === 'string' ? input : input.url;
    if (!/index\.pck(\?.*)?$/.test(url)) return realFetch(input, init);
    const m = await getManifest();
    if (!m) return realFetch(input, init);
    let i = 0, reader = null;
    const stream = new ReadableStream({
      async pull(controller) {
        while (true) {
          if (!reader) {
            if (i >= m.parts.length) { controller.close(); return; }
            const r = await realFetch(m.parts[i++]);
            if (!r.ok) { controller.error(new Error('failed to load ' + m.parts[i - 1])); return; }
            reader = r.body.getReader();
          }
          const { done, value } = await reader.read();
          if (done) { reader = null; continue; }
          controller.enqueue(value);
          return;
        }
      },
    });
    return new Response(stream, {
      status: 200,
      headers: { 'Content-Type': 'application/octet-stream', 'Content-Length': String(m.size) },
    });
  };
})();
