export type Agent = {
  id: string;
  name: string;
  purpose: string;
  scenarioId?: number;
  status: "active" | "paused" | "setup";
};

export const agents: Agent[] = [
  { id: "ceo", name: "CEO Agent", purpose: "Cross-functional business readout and priorities", scenarioId: 6314159, status: "active" },
  { id: "social", name: "Social Media Manager", purpose: "Organic planning, captions, publishing and community", scenarioId: 6333452, status: "active" },
  { id: "meta", name: "Meta Growth", purpose: "Paid-social planning and performance analysis", scenarioId: 6312244, status: "active" },
  { id: "creative", name: "Creative Director", purpose: "Brand worlds, concepts and campaign direction", scenarioId: 6285633, status: "paused" },
  { id: "artwork", name: "Artwork Designer", purpose: "Apparel artwork generation workflow", scenarioId: 6302036, status: "active" },
  { id: "product", name: "Product Builder", purpose: "Printify product-building workflow", scenarioId: 6296470, status: "active" },
  { id: "merch", name: "Merchandising + QA", purpose: "Shopify merchandising and premium QA", scenarioId: 6310648, status: "active" },
  { id: "support", name: "Customer Service", purpose: "Support triage and Gmail draft responses", scenarioId: 6311362, status: "active" },
  { id: "retention", name: "Retention", purpose: "Customer retention and lifecycle opportunities", scenarioId: 6312145, status: "active" }
];