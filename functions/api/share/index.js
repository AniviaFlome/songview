export async function onRequestPost(context) {
  try {
    const { request, env } = context;
    const body = await request.json();

    // Basic validation
    if (!body?.data) {
      return new Response(JSON.stringify({ error: "Missing data" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Generate ID (using crypto.randomUUID matching web standard)
    const id = crypto.randomUUID();

    // Insert into D1
    // We assume 'data' is the JSON string of the song list
    const stmt = env.DB.prepare("INSERT INTO shares (id, data) VALUES (?, ?)");
    await stmt.bind(id, JSON.stringify(body.data)).run();

    return new Response(JSON.stringify({ id }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
