import {
  createAnthropicAgent,
  createBusinessInfoTools,
  FileConversationStore,
  type Agent,
  type BusinessProfile,
} from '@jav/agent';

/**
 * A seed business profile so `/chat` is demoable out of the box. In production
 * this is loaded per-business from the database (JAV-6 knowledge base); for now
 * it's a representative café so the agent has real facts to ground answers on.
 */
export const DEMO_BUSINESS: BusinessProfile = {
  name: 'Blue Spoon Café',
  hours: {
    monday: '8:00 AM – 4:00 PM',
    tuesday: '8:00 AM – 4:00 PM',
    wednesday: '8:00 AM – 4:00 PM',
    thursday: '8:00 AM – 6:00 PM',
    friday: '8:00 AM – 6:00 PM',
    saturday: '9:00 AM – 5:00 PM',
    sunday: 'Closed',
  },
  address: '12 Market Street, Springfield',
  phone: '(555) 010-2020',
  menu: [
    {
      name: 'Flat White',
      description: 'Double-shot espresso with steamed milk',
      price: 4.5,
      allergens: ['milk'],
    },
    {
      name: 'Avocado Toast',
      description: 'Sourdough, smashed avocado, chili flakes',
      price: 9.0,
      allergens: ['gluten'],
    },
    { name: 'Almond Croissant', price: 4.0, allergens: ['gluten', 'nuts'] },
  ],
};

/**
 * Build the production agent from environment configuration. Conversation state
 * is persisted to disk (durable across restarts); the Anthropic provider reads
 * `ANTHROPIC_API_KEY` / `ANTHROPIC_MODEL` from the environment.
 */
export function buildAgentFromEnv(): Agent {
  const conversationsDir = process.env.CONVERSATIONS_DIR ?? '.data/conversations';
  return createAnthropicAgent({
    store: new FileConversationStore(conversationsDir),
    tools: createBusinessInfoTools(DEMO_BUSINESS),
  });
}
