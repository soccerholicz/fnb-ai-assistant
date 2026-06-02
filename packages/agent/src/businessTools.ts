import type { ToolDefinition } from './tools';

/**
 * A minimal, demoable set of F&B / Retail tools backed by an in-memory business
 * profile. This is the first concrete tool surface for the agent — it proves the
 * end-to-end loop and is the seam the knowledge base (JAV-6) and reservations
 * (JAV-8) will grow from / replace with real data sources.
 */

export interface MenuItem {
  name: string;
  description?: string;
  /** Price in the business's currency, as a number (e.g. 12.5). */
  price?: number;
  allergens?: string[];
}

export interface BusinessProfile {
  name: string;
  /** Day (lower-case, e.g. "monday") → human-readable hours or "Closed". */
  hours: Record<string, string>;
  address?: string;
  phone?: string;
  menu?: MenuItem[];
}

function titleCase(value: string): string {
  return value.length === 0 ? value : value[0]!.toUpperCase() + value.slice(1);
}

function formatMenuItem(item: MenuItem): string {
  const parts = [item.name];
  if (typeof item.price === 'number') parts.push(`— ${item.price.toFixed(2)}`);
  if (item.description) parts.push(`(${item.description})`);
  if (item.allergens && item.allergens.length > 0) {
    parts.push(`[allergens: ${item.allergens.join(', ')}]`);
  }
  return parts.join(' ');
}

/**
 * Build the tool set for a given business. Returned tools close over the profile
 * so the agent can answer hours/location/menu questions factually.
 */
export function createBusinessInfoTools(profile: BusinessProfile): ToolDefinition[] {
  const getBusinessHours: ToolDefinition = {
    name: 'get_business_hours',
    description:
      "Get the business's opening hours. Pass a specific weekday to get that day's hours, or omit it for the full week.",
    inputSchema: {
      type: 'object',
      properties: {
        day: {
          type: 'string',
          description: 'Lower-case weekday, e.g. "monday". Omit for the full week.',
        },
      },
      required: [],
      additionalProperties: false,
    },
    handler: (input) => {
      const day = typeof input.day === 'string' ? input.day.trim().toLowerCase() : undefined;
      if (day) {
        const hours = profile.hours[day];
        return hours
          ? `${profile.name} on ${titleCase(day)}: ${hours}.`
          : `I don't have hours listed for "${day}".`;
      }
      const week = Object.entries(profile.hours)
        .map(([d, h]) => `${titleCase(d)}: ${h}`)
        .join('\n');
      return `${profile.name} hours:\n${week}`;
    },
  };

  const getLocation: ToolDefinition = {
    name: 'get_business_location',
    description: 'Get the address and phone number of the business.',
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
      additionalProperties: false,
    },
    handler: () => {
      const lines: string[] = [profile.name];
      if (profile.address) lines.push(`Address: ${profile.address}`);
      if (profile.phone) lines.push(`Phone: ${profile.phone}`);
      return lines.length > 1 ? lines.join('\n') : `I don't have location details on file.`;
    },
  };

  const lookupMenuItem: ToolDefinition = {
    name: 'lookup_menu_item',
    description:
      'Search the menu for items matching a query (by name or description). Returns names, prices, and allergens.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'What the customer is asking about, e.g. "latte".' },
      },
      required: ['query'],
      additionalProperties: false,
    },
    handler: (input) => {
      const menu = profile.menu ?? [];
      if (menu.length === 0) return 'No menu is available for this business.';
      const query = typeof input.query === 'string' ? input.query.trim().toLowerCase() : '';
      if (query.length === 0) {
        return `Our menu:\n${menu.map(formatMenuItem).join('\n')}`;
      }
      const matches = menu.filter(
        (item) =>
          item.name.toLowerCase().includes(query) ||
          (item.description?.toLowerCase().includes(query) ?? false),
      );
      return matches.length > 0
        ? matches.map(formatMenuItem).join('\n')
        : `Nothing on the menu matches "${input.query}".`;
    },
  };

  return [getBusinessHours, getLocation, lookupMenuItem];
}
