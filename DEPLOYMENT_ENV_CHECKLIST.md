# Deployment Environment Variables Checklist

## Server (Render) - Required Variables

Make sure these are set in your Render dashboard:

```
# Database
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-supabase-service-role-key

# JWT Authentication (CRITICAL - must be 32+ characters)
JWT_SECRET=your-super-secret-jwt-key-minimum-32-characters-long-change-this

# Frontend URL (for CORS)
FRONTEND_URL=https://www.impactlyai.com

# AI Provider (at least one)
NVIDIA_NIM_API_KEY=your-nvidia-nim-api-key
MISTRAL_API_KEY=your-mistral-api-key

# Optional: Email (Brevo)
BREVO_API_KEY=your-brevo-api-key
BREVO_FROM_EMAIL=noreply@yourdomain.com

# Optional: PostHog
POSTHOG_API_KEY=your-posthog-project-api-key
POSTHOG_HOST=https://us.i.posthog.com

# Server
NODE_ENV=production
```

### Critical Issues to Check:

1. **JWT_SECRET** - Must be the SAME value that was used when users originally logged in
   - If you change this, ALL existing users will be logged out and need to re-login
   - Generate a new one: `openssl rand -base64 32`

2. **SUPABASE_SERVICE_KEY** - Must be the service role key (not anon key)
   - Get from: Supabase Dashboard → Settings → API → Service Role Key

3. **FRONTEND_URL** - Must include your production domain
   - Set to: `https://www.impactlyai.com`

4. **Server hibernation** - Render free tier hibernates after 15 minutes of inactivity
   - First request after hibernation takes 30-60 seconds to wake up
   - Solution: Upgrade to paid tier or use uptime monitoring service

## Client (Vercel) - Required Variables

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_API_URL=https://worklog-ai-server.onrender.com
VITE_POSTHOG_KEY=your-posthog-project-api-key
```

## Troubleshooting 401 Errors

If users are getting 401 Unauthorized errors:

1. Check `JWT_SECRET` is set correctly on server
2. Check `SUPABASE_SERVICE_KEY` is set correctly on server
3. Users may need to log out and log back in if JWT_SECRET was changed
4. Check server logs on Render for authentication errors

## Troubleshooting Network Errors

If seeing `ERR_NETWORK_IO_SUSPENDED`:

1. Server is hibernating (free tier limit)
2. First request wakes the server (30-60 second delay)
3. Check Render logs to see if server is starting properly
4. Consider upgrading to paid tier for always-on