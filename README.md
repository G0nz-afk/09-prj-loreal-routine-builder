# Project 9: L'Oréal Routine Builder

L’Oréal is expanding what’s possible with AI, and now your chatbot is getting smarter. This week, you’ll upgrade it into a product-aware routine builder.

Users will be able to browse real L’Oréal brand products, select the ones they want, and generate a personalized routine using AI. They can also ask follow-up questions about their routine—just like chatting with a real advisor.

## Web-search chatbot setup

This project now includes a Cloudflare Worker in [worker.js](worker.js) and [wrangler.toml](wrangler.toml) that calls OpenAI with web search enabled and returns JSON shaped like:

- `answer`: the assistant response text
- `citations`: an array of `{ title, url }` links

To deploy it:

1. Install Wrangler.
2. Add your OpenAI key as a Cloudflare secret:
   - `wrangler secret put OPENAI_API_KEY`
3. Deploy the worker:
   - `wrangler deploy`
4. Copy the deployed `workers.dev` URL into [secrets.js](secrets.js).

The frontend already renders citation links returned by the worker.
