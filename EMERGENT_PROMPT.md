# Emergent Prompt For Flairo

Build and continue this as a mobile resident benefits application for Flairo using Expo and React Native.

The current project already contains a branded Expo prototype. Please preserve the Flairo brand direction:

- Premium matte charcoal / black interface
- Flamingo pink, dusty pink, gold accent, warm ivory, ash gray, and deep taupe color system
- Flairo logo and badge imagery from the included `assets` folder
- High-contrast, premium resident-benefits feel
- Hexagon / badge-inspired visual language
- Messaging around exclusive perks, elevated living, and resident lifestyle benefits

Core resident MVP:

- Mobile-first resident home dashboard
- Resident profile with property, unit, membership, payment, notifications, and support placeholders
- Browse concierge services and partner perks
- Request move-out cleaning, painting, preferred movers, junk removal, and utility setup
- Rewards wallet with points balance and redemption options
- Booking/request activity with status timeline
- Flairo Plus membership placeholder with upgraded state

Please turn the prototype into a more complete app while keeping the current app design recognizable. Add real screen structure, navigation, durable data models, and a backend appropriate for Emergent's mobile stack. Use Expo/React Native for the mobile app, FastAPI for backend APIs, and MongoDB for storage if backend persistence is added.

Important implementation goals:

- Keep the first release simple and testable on iPhone through Expo preview.
- Preserve the supplied assets and brand palette.
- Make the booking flow functional enough to create, view, and update draft service requests.
- Make rewards and membership state persist across app reloads.
- Add authentication/onboarding only after the core resident flow is stable.
- Test the main resident flows thoroughly before deployment.

Main flows to test:

1. Open home dashboard.
2. Toggle Flairo Plus membership.
3. Browse perks/services by category.
4. Select a service and create a request.
5. Confirm the request appears in Activity.
6. Confirm points increase after service request.
7. Redeem an available reward when enough points exist.
8. Review profile/settings placeholders.
