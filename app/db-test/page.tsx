import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export default async function DbTestPage() {
  const settings = await prisma.settings.findFirst();

  return (
    <main style={{ padding: 32, fontFamily: "Arial" }}>
      <h1>Database Test</h1>
      <pre>{JSON.stringify(settings, null, 2)}</pre>
    </main>
  );
}
