import type { MetaFunction } from "@remix-run/node";

export const meta: MetaFunction = () => {
  return [
    { title: "SpinForge Remix Test App" },
    { name: "description", content: "Testing Remix deployment on SpinForge" },
  ];
};

export default function Index() {
  return (
    <div style={{ fontFamily: "system-ui, sans-serif", padding: "2rem" }}>
      <h1>SpinForge Remix Test App</h1>
      <p>This is a test Remix application for SpinForge deployment validation.</p>
      <p>Deployment Method: {process.env.DEPLOY_METHOD || 'Unknown'}</p>
      <p>Build Time: {new Date().toISOString()}</p>
    </div>
  );
}