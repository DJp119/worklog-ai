# AI Provider Setup Guide

## Overview

WorkLog AI supports multiple AI providers with automatic fallback:

1. **NVIDIA NIM** (Primary - Free)
   - Rate limit: 40 requests/minute
   - Token limit: 30,000 tokens/minute
   - Model: Llama 3.1 70B Instruct
   - Cost: Free through NVIDIA developer program

2. **Mistral AI** (Fallback - Paid)
   - Rate limit: Configurable
   - Model: Mistral Large
   - Cost: ~$2/1M tokens input, $6/1M tokens output

## Configuration

### Step 1: Get NVIDIA NIM API Key

1. Visit [build.nvidia.com](https://build.nvidia.com/explore/discover)
2. Sign in with Google/GitHub account
3. Click on any model → "Get API Key"
4. Copy the generated API key

### Step 2: Get Mistral API Key (Optional, for fallback)

1. Visit [console.mistral.ai](https://console.mistral.ai/api-keys/)
2. Create API key
3. Note your quota limits

### Step 3: Configure Environment Variables

```bash
# In server/.env
NVIDIA_NIM_API_KEY=nvid_...your-key-here...
MISTRAL_API_KEY=your-mistral-key-here
```

### Step 4: Verify Configuration

```bash
cd server
npm run dev

# Look for startup log:
# "AI Provider: NVIDIA NIM configured as primary provider"
# or
# "AI Provider: NVIDIA NIM not configured, using Mistral only"
```

## Monitoring

### Check Current Usage

The API provider status is logged with each request:
```
[AI Provider] Used NVIDIA NIM (remaining: 35)
[AI Provider] Using Mistral (fallback)
```

### Manual Status Check

Make a request to check provider status:
```bash
curl http://localhost:3001/health
```

## Troubleshooting

### All requests going to Mistral

- Check `NVIDIA_NIM_API_KEY` is set correctly
- Verify key is valid at build.nvidia.com
- Check rate limit not exceeded (40 RPM)

### Frequent fallback to Mistral

- Your traffic exceeds 40 RPM
- Consider caching responses or reducing API calls
- Mistral costs will increase proportionally

## Cost Estimates

| Provider | Free Tier | Paid Tier | Est. Monthly Cost (100 users) |
|----------|-----------|-----------|-------------------------------|
| NVIDIA NIM | 40 RPM | Contact sales | $0 (within limits) |
| Mistral AI | $0 | Pay per token | ~$20-50/month |

## Fallback Behavior

### Automatic Fallback Triggers

1. **Rate Limit Exceeded**: When NVIDIA NIM approaches 40 RPM (switches at 38 RPM with safety margin)
2. **API Errors**: Network errors, 5xx responses from NVIDIA NIM
3. **Missing Configuration**: If `NVIDIA_NIM_API_KEY` is not set

### Stream Handling

If rate limit is hit mid-stream, the stream aborts and falls back to Mistral for the next request (not mid-stream).

## Rolling Back

If issues arise:
1. Remove `NVIDIA_NIM_API_KEY` from `.env`
2. Restart server
3. All traffic goes to Mistral only
4. No code changes needed

## Benefits

- **Cost Reduction**: 80-90% reduction by using free NVIDIA NIM tier for most traffic
- **Improved Reliability**: Automatic fallback prevents service outages when one provider hits limits
- **No User Impact**: Fallback is seamless - users see no difference