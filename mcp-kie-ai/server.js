#!/usr/bin/env node
/**
 * MCP Server: Kie.ai Image Generation
 * Supports: nano-banana-2, flux-kontext-pro, flux-kontext-max, gpt4o-image
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

const API_KEY = process.env.KIE_API_KEY || "1b812df5afc6b9ed878c661d7247379f";
const BASE_URL = "https://api.kie.ai/api/v1";

async function kieRequest(path, method = "GET", body = null) {
  const opts = {
    method,
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      "Content-Type": "application/json",
    },
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${BASE_URL}${path}`, opts);
  return res.json();
}

async function pollTask(taskId, intervalMs = 4000, maxWaitMs = 180000) {
  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    await new Promise((r) => setTimeout(r, intervalMs));
    const data = await kieRequest(`/jobs/recordInfo?taskId=${taskId}`);
    if (data?.data?.state === "success") return data.data;
    if (data?.data?.state === "fail") throw new Error(`Task failed: ${data.data.failMsg}`);
  }
  throw new Error("Task timed out after 3 minutes");
}

function extractImageUrls(record) {
  try {
    const parsed = JSON.parse(record.resultJson || "{}");
    return parsed.resultUrls || parsed.result_urls || [];
  } catch {
    return [];
  }
}

const server = new Server(
  { name: "kie-ai", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "generate_image",
      description:
        "Generate an image using Kie.ai. Supports nano-banana-2 (4K photorealistic), flux-kontext-pro, flux-kontext-max, and gpt4o-image models.",
      inputSchema: {
        type: "object",
        properties: {
          prompt: {
            type: "string",
            description: "Detailed text prompt describing the image to generate",
          },
          model: {
            type: "string",
            enum: ["nano-banana-2", "flux-kontext-pro", "flux-kontext-max", "gpt4o-image"],
            description: "Model to use. nano-banana-2 for 4K photorealistic images.",
            default: "nano-banana-2",
          },
          aspectRatio: {
            type: "string",
            enum: ["16:9", "1:1", "4:3", "9:16", "21:9", "3:4"],
            description: "Image aspect ratio",
            default: "16:9",
          },
          outputFormat: {
            type: "string",
            enum: ["jpeg", "png"],
            default: "jpeg",
          },
          wait: {
            type: "boolean",
            description: "If true, poll until the image is ready and return the URL",
            default: true,
          },
        },
        required: ["prompt"],
      },
    },
    {
      name: "generate_image_nano_banana",
      description:
        "Generate a 4K photorealistic image with nano-banana-2 model via the createTask endpoint.",
      inputSchema: {
        type: "object",
        properties: {
          prompt: {
            type: "string",
            description: "Detailed description of the image",
          },
          negativePrompt: {
            type: "string",
            description: "Elements to exclude from the image",
          },
          width: {
            type: "number",
            description: "Image width in pixels (e.g. 3840 for 4K)",
            default: 1920,
          },
          height: {
            type: "number",
            description: "Image height in pixels (e.g. 2160 for 4K)",
            default: 1080,
          },
          wait: {
            type: "boolean",
            default: true,
          },
        },
        required: ["prompt"],
      },
    },
    {
      name: "get_task_status",
      description: "Check the status of a Kie.ai generation task",
      inputSchema: {
        type: "object",
        properties: {
          taskId: { type: "string", description: "The task ID returned from a generation call" },
        },
        required: ["taskId"],
      },
    },
    {
      name: "get_account_credits",
      description: "Check the current Kie.ai account credit balance",
      inputSchema: { type: "object", properties: {} },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    if (name === "get_account_credits") {
      const data = await kieRequest("/chat/credit");
      return {
        content: [{ type: "text", text: `Account credits: ${data.data}` }],
      };
    }

    if (name === "get_task_status") {
      const data = await kieRequest(`/jobs/recordInfo?taskId=${args.taskId}`);
      const record = data.data;
      let text = `Task: ${args.taskId}\nState: ${record?.state}\n`;
      if (record?.state === "success") {
        const urls = extractImageUrls(record);
        text += `Image URLs:\n${urls.join("\n")}`;
      } else if (record?.state === "fail") {
        text += `Error: ${record.failMsg}`;
      } else {
        text += "Still processing...";
      }
      return { content: [{ type: "text", text }] };
    }

    if (name === "generate_image") {
      const model = args.model || "nano-banana-2";
      let taskId;

      if (model === "gpt4o-image") {
        const res = await kieRequest("/gpt4o-image/generate", "POST", {
          prompt: args.prompt,
          size: args.aspectRatio === "16:9" ? "3:2" : args.aspectRatio === "9:16" ? "2:3" : "1:1",
          nVariants: 1,
        });
        taskId = res.data?.taskId;
      } else if (model === "nano-banana-2") {
        const res = await kieRequest("/jobs/createTask", "POST", {
          model: "nano-banana-2",
          input: {
            prompt: args.prompt,
            aspect_ratio: args.aspectRatio || "16:9",
          },
        });
        taskId = res.data?.taskId;
      } else {
        // flux-kontext
        const res = await kieRequest("/flux/kontext/generate", "POST", {
          prompt: args.prompt,
          model,
          aspectRatio: args.aspectRatio || "16:9",
          outputFormat: args.outputFormat || "jpeg",
        });
        taskId = res.data?.taskId;
      }

      if (!taskId) {
        return { content: [{ type: "text", text: "Failed to create task" }], isError: true };
      }

      if (!args.wait) {
        return { content: [{ type: "text", text: `Task created. ID: ${taskId}` }] };
      }

      const record = await pollTask(taskId);
      const urls = extractImageUrls(record);
      return {
        content: [
          {
            type: "text",
            text: `Image generated successfully!\nTask ID: ${taskId}\nURLs:\n${urls.join("\n")}`,
          },
        ],
      };
    }

    if (name === "generate_image_nano_banana") {
      const res = await kieRequest("/jobs/createTask", "POST", {
        model: "nano-banana-2",
        input: {
          prompt: args.prompt,
          negative_prompt: args.negativePrompt || "",
          width: args.width || 1920,
          height: args.height || 1080,
        },
      });

      const taskId = res.data?.taskId;
      if (!taskId) {
        return { content: [{ type: "text", text: `API error: ${JSON.stringify(res)}` }], isError: true };
      }

      if (!args.wait) {
        return { content: [{ type: "text", text: `Task created. ID: ${taskId}` }] };
      }

      const record = await pollTask(taskId);
      const urls = extractImageUrls(record);
      return {
        content: [
          {
            type: "text",
            text: `4K image ready!\nTask ID: ${taskId}\nURLs:\n${urls.join("\n")}`,
          },
        ],
      };
    }

    return { content: [{ type: "text", text: `Unknown tool: ${name}` }], isError: true };
  } catch (err) {
    return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
