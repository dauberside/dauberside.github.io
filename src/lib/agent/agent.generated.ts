/*
  AUTO-GENERATED FILE - DO NOT EDIT
  Source: src/lib/agent/configs/sample.json
*/

import { Agent, tool } from "@openai/agents";
import { z } from "zod";

type echoParams = {
  text: string;
};

const echoParamsV3 = z.object({
  text: z.string(),
});

async function echo(args: echoParams) {
  // TODO: implement tool - Echo back input text
  return { ok: true, tool: "echo", args };
}

export const agent = new Agent({
  name: "sample",
  instructions: "You are a helpful assistant. Keep answers short.",
  tools: [
    tool({
      name: "echo",
      description: "Echo back input text",
      // zod v3 schema cast to any for Agent types expecting v4
      parameters: echoParamsV3 as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      execute: async (input: any) => echo(input as echoParams),
    }),
  ],
});
