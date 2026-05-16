# ADR-001: Multi-Provider AI Strategy with NVIDIA NIM Primary + Mistral Fallback

## Status

Proposed

## Context

The application currently uses only Mistral AI for all AI-powered features (chat, monthly summaries, appraisals). Mistral API is a paid service with the following implications:

- **Cost**: ~$20-50/month for moderate usage (100 users)
- **Rate Limits**: Fixed quotas that can cause service outages under high load
- **Single Point of Failure**: No redundancy if Mistral API experiences issues

NVIDIA NIM (NVIDIA Inference Microservices) offers a free tier through their developer program:
- 40 requests per minute (RPM)
- 30,000 tokens per minute (TPM)
- Access to Llama 3.1 70B Instruct and other models
- No credit card required

## Decision

We will implement a multi-provider architecture with:

1. **Primary Provider**: NVIDIA NIM (free tier)
2. **Fallback Provider**: Mistral AI (paid)

### Architecture Pattern

```
Request → NVIDIA NIM (Primary) ══[429/Rate Limit/Error]══> Mistral (Fallback)
```

### Implementation Details

- **Rate Limit Tracking**: Client-side RPM counter with 60-second sliding window
- **Safety Margin**: Switch to fallback at 38 RPM (2-request buffer)
- **Fallback Triggers**: Rate limits, API errors, missing configuration
- **Provider Selection**: Per-request basis, transparent to users

### Files Modified

- `server/src/lib/nvidiaNim.ts` - New: NVIDIA NIM API client
- `server/src/lib/aiProvider.ts` - New: Multi-provider abstraction
- `server/src/lib/mistral.ts` - Modified: Export client for fallback usage
- `server/src/routes/chat.ts` - Modified: Use aiProvider.stream()
- `server/src/lib/summaryService.ts` - Modified: Use aiProvider.complete()
- `server/src/routes/appraisal.ts` - Modified: Use aiProvider.complete()
- `server/.env.example` - Modified: Added NVIDIA_NIM_API_KEY

## Consequences

### Positive

1. **Cost Reduction**: 80-90% reduction in AI API costs for typical usage
2. **Improved Reliability**: Automatic fallback prevents service outages
3. **No User Impact**: Fallback is seamless and transparent
4. **No New Dependencies**: Uses native `fetch`, no npm packages required

### Negative

1. **Operational Complexity**: Two API keys to manage
2. **Provider Drift**: Slight response differences between Llama 3.1 and Mistral Large
3. **Rate Limit Monitoring**: Need to track both providers' usage

### Neutral

1. **Logging**: Provider choice is logged for monitoring/debugging
2. **Rollback**: Can disable NVIDIA NIM by removing env var (no code changes)

## Migration Path

1. Deploy code changes
2. Add `NVIDIA_NIM_API_KEY` to server environment variables
3. Monitor provider usage via logs
4. Adjust rate limit thresholds if needed

## Rollback Plan

If issues arise:
1. Remove `NVIDIA_NIM_API_KEY` from `.env`
2. Restart server
3. All traffic automatically routes to Mistral
4. No code rollback required

## Future Considerations

- Potential to add more providers (OpenAI, Anthropic) using same architecture
- Consider server-side rate limit caching for multi-instance deployments
- Monitor NVIDIA NIM free tier terms for potential changes