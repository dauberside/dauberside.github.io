#!/usr/bin/env node
/**
 * Cortex OS Time MCP Server
 *
 * MCP stdio server for time/date operations:
 * - Current time in multiple timezones
 * - Date arithmetic (add/subtract days, weeks, months)
 * - Date formatting
 * - Period calculations (week ranges, month ranges)
 *
 * Optimized for Cortex OS automation workflows.
 *
 * Usage:
 *   node services/mcp/time.mjs
 *
 * Protocol: JSON-RPC 2.0 over stdio
 */

/**
 * MCP Tools
 */
const tools = {
  /**
   * Get current time in various formats
   */
  get_current_time({ timezone = 'Asia/Tokyo', format = 'iso' } = {}) {
    const now = new Date();
    
    // Convert to specified timezone
    const options = {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    };
    
    const formatter = new Intl.DateTimeFormat('en-US', options);
    const parts = formatter.formatToParts(now);
    
    const get = (type) => parts.find(p => p.type === type)?.value;
    
    const year = get('year');
    const month = get('month');
    const day = get('day');
    const hour = get('hour');
    const minute = get('minute');
    const second = get('second');
    
    const result = {
      iso: now.toISOString(),
      timestamp: now.getTime(),
      timezone,
    };
    
    // Format options
    switch (format) {
      case 'iso':
        result.formatted = now.toISOString();
        break;
      case 'date':
        result.formatted = `${year}-${month}-${day}`;
        break;
      case 'datetime':
        result.formatted = `${year}-${month}-${day} ${hour}:${minute}:${second}`;
        break;
      case 'human':
        result.formatted = `${year}年${month}月${day}日 ${hour}:${minute}`;
        break;
      default:
        result.formatted = now.toISOString();
    }
    
    return result;
  },

  /**
   * Add or subtract time from a date
   */
  add_time({ date, amount, unit = 'days', timezone = 'Asia/Tokyo' } = {}) {
    const baseDate = date ? new Date(date) : new Date();
    
    if (isNaN(baseDate.getTime())) {
      throw new Error(`Invalid date: ${date}`);
    }
    
    let resultDate = new Date(baseDate);
    
    switch (unit) {
      case 'seconds':
        resultDate.setSeconds(resultDate.getSeconds() + amount);
        break;
      case 'minutes':
        resultDate.setMinutes(resultDate.getMinutes() + amount);
        break;
      case 'hours':
        resultDate.setHours(resultDate.getHours() + amount);
        break;
      case 'days':
        resultDate.setDate(resultDate.getDate() + amount);
        break;
      case 'weeks':
        resultDate.setDate(resultDate.getDate() + (amount * 7));
        break;
      case 'months':
        resultDate.setMonth(resultDate.getMonth() + amount);
        break;
      case 'years':
        resultDate.setFullYear(resultDate.getFullYear() + amount);
        break;
      default:
        throw new Error(`Invalid unit: ${unit}`);
    }
    
    return {
      original: baseDate.toISOString(),
      result: resultDate.toISOString(),
      formatted: formatDate(resultDate),
      operation: `${amount > 0 ? '+' : ''}${amount} ${unit}`,
    };
  },

  /**
   * Format a date string
   */
  format_date({ date, format = 'YYYY-MM-DD', timezone = 'Asia/Tokyo' } = {}) {
    const d = date ? new Date(date) : new Date();
    
    if (isNaN(d.getTime())) {
      throw new Error(`Invalid date: ${date}`);
    }
    
    const options = {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
      weekday: 'long'
    };
    
    const formatter = new Intl.DateTimeFormat('en-US', options);
    const parts = formatter.formatToParts(d);
    
    const get = (type) => parts.find(p => p.type === type)?.value;
    
    const year = get('year');
    const month = get('month');
    const day = get('day');
    const hour = get('hour');
    const minute = get('minute');
    const second = get('second');
    const weekday = get('weekday');
    
    let formatted = format
      .replace('YYYY', year)
      .replace('MM', month)
      .replace('DD', day)
      .replace('HH', hour)
      .replace('mm', minute)
      .replace('ss', second)
      .replace('WD', weekday);
    
    return {
      original: d.toISOString(),
      formatted,
      timezone,
      weekday,
    };
  },

  /**
   * Get week range (Monday to Sunday)
   */
  get_week_range({ date, timezone = 'Asia/Tokyo' } = {}) {
    const d = date ? new Date(date) : new Date();
    
    if (isNaN(d.getTime())) {
      throw new Error(`Invalid date: ${date}`);
    }
    
    // Get day of week (0 = Sunday, 1 = Monday, ...)
    const dayOfWeek = d.getDay();
    
    // Calculate Monday (start of week)
    const monday = new Date(d);
    const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    monday.setDate(d.getDate() - daysFromMonday);
    monday.setHours(0, 0, 0, 0);
    
    // Calculate Sunday (end of week)
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);
    
    // Get ISO week number
    const weekNumber = getISOWeek(d);
    
    return {
      weekNumber,
      year: d.getFullYear(),
      monday: formatDate(monday),
      sunday: formatDate(sunday),
      range: `${formatDate(monday)} to ${formatDate(sunday)}`,
      isoWeek: `${d.getFullYear()}-W${String(weekNumber).padStart(2, '0')}`,
    };
  },

  /**
   * Get month range
   */
  get_month_range({ date, timezone = 'Asia/Tokyo' } = {}) {
    const d = date ? new Date(date) : new Date();
    
    if (isNaN(d.getTime())) {
      throw new Error(`Invalid date: ${date}`);
    }
    
    // First day of month
    const firstDay = new Date(d.getFullYear(), d.getMonth(), 1);
    firstDay.setHours(0, 0, 0, 0);
    
    // Last day of month
    const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0);
    lastDay.setHours(23, 59, 59, 999);
    
    return {
      year: d.getFullYear(),
      month: d.getMonth() + 1,
      firstDay: formatDate(firstDay),
      lastDay: formatDate(lastDay),
      range: `${formatDate(firstDay)} to ${formatDate(lastDay)}`,
      totalDays: lastDay.getDate(),
    };
  },

  /**
   * Calculate difference between two dates
   */
  date_diff({ start, end, unit = 'days' } = {}) {
    const startDate = new Date(start);
    const endDate = new Date(end);
    
    if (isNaN(startDate.getTime())) {
      throw new Error(`Invalid start date: ${start}`);
    }
    if (isNaN(endDate.getTime())) {
      throw new Error(`Invalid end date: ${end}`);
    }
    
    const diffMs = endDate - startDate;
    
    let result;
    switch (unit) {
      case 'seconds':
        result = Math.floor(diffMs / 1000);
        break;
      case 'minutes':
        result = Math.floor(diffMs / (1000 * 60));
        break;
      case 'hours':
        result = Math.floor(diffMs / (1000 * 60 * 60));
        break;
      case 'days':
        result = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        break;
      case 'weeks':
        result = Math.floor(diffMs / (1000 * 60 * 60 * 24 * 7));
        break;
      default:
        throw new Error(`Invalid unit: ${unit}`);
    }
    
    return {
      start: startDate.toISOString(),
      end: endDate.toISOString(),
      difference: result,
      unit,
      description: `${result} ${unit}`,
    };
  },
};

/**
 * Helper: Format date as YYYY-MM-DD
 */
function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Helper: Get ISO week number
 */
function getISOWeek(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 4 - (d.getDay() || 7));
  const yearStart = new Date(d.getFullYear(), 0, 1);
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

/**
 * JSON-RPC 2.0 handler
 */
async function handleRequest(request) {
  const { id, method, params } = request;

  try {
    if (method === 'initialize') {
      return {
        jsonrpc: '2.0',
        id,
        result: {
          protocolVersion: '2024-11-05',
          serverInfo: {
            name: 'cortex-time',
            version: '1.0.0',
          },
          capabilities: {
            tools: {},
          },
        },
      };
    }

    if (method === 'tools/list') {
      return {
        jsonrpc: '2.0',
        id,
        result: {
          tools: [
            {
              name: 'get_current_time',
              description: 'Get current time in specified timezone and format',
              inputSchema: {
                type: 'object',
                properties: {
                  timezone: { type: 'string', description: 'Timezone (default: Asia/Tokyo)', default: 'Asia/Tokyo' },
                  format: { 
                    type: 'string', 
                    description: 'Format: iso, date, datetime, human (default: iso)', 
                    enum: ['iso', 'date', 'datetime', 'human'],
                    default: 'iso'
                  },
                },
              },
            },
            {
              name: 'add_time',
              description: 'Add or subtract time from a date',
              inputSchema: {
                type: 'object',
                properties: {
                  date: { type: 'string', description: 'Base date (ISO format, default: now)' },
                  amount: { type: 'number', description: 'Amount to add (negative to subtract)' },
                  unit: { 
                    type: 'string', 
                    description: 'Unit: seconds, minutes, hours, days, weeks, months, years', 
                    enum: ['seconds', 'minutes', 'hours', 'days', 'weeks', 'months', 'years'],
                    default: 'days'
                  },
                  timezone: { type: 'string', description: 'Timezone (default: Asia/Tokyo)', default: 'Asia/Tokyo' },
                },
                required: ['amount'],
              },
            },
            {
              name: 'format_date',
              description: 'Format a date string',
              inputSchema: {
                type: 'object',
                properties: {
                  date: { type: 'string', description: 'Date to format (ISO format, default: now)' },
                  format: { type: 'string', description: 'Format string (YYYY-MM-DD, etc)', default: 'YYYY-MM-DD' },
                  timezone: { type: 'string', description: 'Timezone (default: Asia/Tokyo)', default: 'Asia/Tokyo' },
                },
              },
            },
            {
              name: 'get_week_range',
              description: 'Get week range (Monday to Sunday) for a given date',
              inputSchema: {
                type: 'object',
                properties: {
                  date: { type: 'string', description: 'Date within the week (ISO format, default: now)' },
                  timezone: { type: 'string', description: 'Timezone (default: Asia/Tokyo)', default: 'Asia/Tokyo' },
                },
              },
            },
            {
              name: 'get_month_range',
              description: 'Get month range (first to last day) for a given date',
              inputSchema: {
                type: 'object',
                properties: {
                  date: { type: 'string', description: 'Date within the month (ISO format, default: now)' },
                  timezone: { type: 'string', description: 'Timezone (default: Asia/Tokyo)', default: 'Asia/Tokyo' },
                },
              },
            },
            {
              name: 'date_diff',
              description: 'Calculate difference between two dates',
              inputSchema: {
                type: 'object',
                properties: {
                  start: { type: 'string', description: 'Start date (ISO format)' },
                  end: { type: 'string', description: 'End date (ISO format)' },
                  unit: { 
                    type: 'string', 
                    description: 'Unit: seconds, minutes, hours, days, weeks', 
                    enum: ['seconds', 'minutes', 'hours', 'days', 'weeks'],
                    default: 'days'
                  },
                },
                required: ['start', 'end'],
              },
            },
          ],
        },
      };
    }

    if (method === 'tools/call') {
      const { name, arguments: args } = params;

      if (!tools[name]) {
        throw new Error(`Unknown tool: ${name}`);
      }

      const result = tools[name](args);

      return {
        jsonrpc: '2.0',
        id,
        result: {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        },
      };
    }

    throw new Error(`Unknown method: ${method}`);
  } catch (error) {
    return {
      jsonrpc: '2.0',
      id,
      error: {
        code: -32603,
        message: error.message,
      },
    };
  }
}

/**
 * Main: stdio server loop
 */
async function main() {
  const readline = (await import('readline')).default;

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false,
  });

  rl.on('line', async (line) => {
    try {
      const request = JSON.parse(line);
      const response = await handleRequest(request);
      console.log(JSON.stringify(response));
    } catch (error) {
      console.error(JSON.stringify({
        jsonrpc: '2.0',
        id: null,
        error: {
          code: -32700,
          message: 'Parse error',
        },
      }));
    }
  });
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
