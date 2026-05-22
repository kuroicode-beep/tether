---
name: Tether
colors:
  surface: '#fff8f2'
  surface-dim: '#e2d9cc'
  surface-bright: '#fff8f2'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#fcf2e5'
  surface-container: '#f6eddf'
  surface-container-high: '#f0e7da'
  surface-container-highest: '#eae1d4'
  on-surface: '#1f1b13'
  on-surface-variant: '#414943'
  inverse-surface: '#343027'
  inverse-on-surface: '#f9efe2'
  outline: '#717972'
  outline-variant: '#c0c9c1'
  surface-tint: '#37684d'
  primary: '#316248'
  on-primary: '#ffffff'
  primary-container: '#4a7b5f'
  on-primary-container: '#dcffe7'
  inverse-primary: '#9ed2b1'
  secondary: '#526259'
  on-secondary: '#ffffff'
  secondary-container: '#d3e4d8'
  on-secondary-container: '#57665d'
  tertiary: '#595953'
  on-tertiary: '#ffffff'
  tertiary-container: '#72716b'
  on-tertiary-container: '#f9f6ef'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#b9efcd'
  primary-fixed-dim: '#9ed2b1'
  on-primary-fixed: '#002112'
  on-primary-fixed-variant: '#1e5037'
  secondary-fixed: '#d6e7db'
  secondary-fixed-dim: '#bacbbf'
  on-secondary-fixed: '#101e17'
  on-secondary-fixed-variant: '#3b4a41'
  tertiary-fixed: '#e5e2db'
  tertiary-fixed-dim: '#c9c6c0'
  on-tertiary-fixed: '#1c1c18'
  on-tertiary-fixed-variant: '#474742'
  background: '#fff8f2'
  on-background: '#1f1b13'
  surface-variant: '#eae1d4'
typography:
  display-lg:
    fontFamily: Inter
    fontSize: 48px
    fontWeight: '600'
    lineHeight: '1.1'
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '600'
    lineHeight: '1.2'
    letterSpacing: -0.01em
  headline-lg-mobile:
    fontFamily: Inter
    fontSize: 28px
    fontWeight: '600'
    lineHeight: '1.2'
  headline-md:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '500'
    lineHeight: '1.3'
  body-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '400'
    lineHeight: '1.6'
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.5'
  label-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '500'
    lineHeight: '1.4'
    letterSpacing: 0.01em
  label-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '600'
    lineHeight: '1.4'
    letterSpacing: 0.05em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 32px
  xxl: 48px
  margin-mobile: 20px
  margin-desktop: 40px
  gutter: 16px
---

## Brand & Style

The design system is centered on intimacy, warmth, and the quiet strength of long-term partnership. It is designed to feel like a digital sanctuary—a private, shared garden for two people to connect without the noise of the outside world.

The aesthetic blends **Modern Minimalism** with **Tactile Softness**. It avoids the sterility of typical SaaS interfaces by utilizing a nature-inspired palette and organic shapes. The interface prioritizes calm interactions over urgency, using generous whitespace and a rhythmic vertical flow to evoke a sense of groundedness and peace.

**Emotional Response:**
- **Calm:** Low-frequency visual noise and soothing sage tones.
- **Intimate:** Focus on 1:1 interactions and shared memories.
- **Reliable:** Sturdy typography and clear structural hierarchy.

## Colors

The color strategy is divided into two primary modes:

1.  **Sage (Default):** A soft, low-contrast "bookish" aesthetic using creamy off-whites and desaturated greens. This mode mimics the feel of high-quality recycled paper and botanical elements.
2.  **High Contrast (Dark):** A deep, immersive environment for evening use. It utilizes high-legibility mint accents against forest-shadow backgrounds to maintain accessibility while preserving the intimate mood.

Semantic colors should be used sparingly. Success states use a brighter leaf-green, while warnings use a soft terracotta to stay within the organic theme.

## Typography

This design system utilizes **Inter** exclusively to provide a systematic, highly legible foundation that balances the "softness" of the UI shapes. 

- **Scale:** A modular scale ensures that hierarchy is maintained even in text-heavy personal notes or shared journals.
- **Leading:** Body text uses a generous 1.5x to 1.6x line height to prevent fatigue and enhance the "calm" aesthetic.
- **Styling:** Headlines should use tighter tracking (-0.01em to -0.02em) to appear more cohesive, while small labels use slightly expanded tracking for clarity against textured backgrounds.

## Layout & Spacing

The system is built on an **8px linear grid**. This ensures mathematical harmony across all components.

- **Layout Model:** A fluid grid for mobile and tablet, transitioning to a centered fixed-width container (max 1200px) for desktop to maintain intimacy and prevent "information stretch."
- **Padding:** Vertical spacing is intentionally generous (XXL units) between major sections to allow the content to "breathe."
- **Consistency:** All component heights and internal padding must be multiples of 8px.

## Elevation & Depth

Depth is achieved through **Tonal Layers** and **Subtle Shadows** rather than harsh borders or deep gradients.

- **Shadows:** Use extremely soft, diffused shadows. A standard elevation (Level 1) should use a 12px blur with only 4-6% opacity of the `Primary Dark` color to ground the element naturally.
- **Tonal Stepping:** Surfaces (cards) sit on the Background. Modals and pop-overs sit on the Surface. Each step up is slightly lighter in the Sage theme and slightly more saturated in the Dark theme.
- **Glassmorphism:** Use sparingly for navigation bars or floating action buttons, employing a 12px backdrop blur to maintain the nature-inspired, "misty" feel.

## Shapes

The shape language is rounded and organic, avoiding sharp corners to reinforce the "soft" brand personality.

- **Cards:** 16px radius creates a friendly, approachable container for content.
- **Modals:** 24px radius emphasizes the "enveloping" nature of primary interactions.
- **Pill Shapes:** Interactive elements like buttons and chips use a fully rounded (pill) radius to signal clear touch targets and a playful, modern energy.
- **Icons:** Should use a 1.5pt or 2pt rounded stroke cap to match the UI's softness.

## Components

**Buttons:** 
- Primary: Pill-shaped, `Primary` color background, `Surface` text. No harsh gradients. 
- Secondary: Pill-shaped, `Border` outline, `Primary` text.

**Input Fields:** 
- 12px corner radius. Background should be slightly darker than the surface in Light mode to create a "well" effect. Transitions on focus should use a 2px `Primary Mid` stroke.

**Cards:**
- 16px corner radius. No borders; use a subtle Level 1 shadow and a 1px `Surface` stroke for definition against the `Background`.

**Chips (Tags):**
- Used for mood tracking or shared interests. Pill-shaped, 32px height, using `Primary Mid` at 10% opacity with `Primary` text.

**The "Tether" Component:**
- A unique component representing the connection between the couple. A continuous, soft-curved line or progress bar that uses a gradient between `Primary` and `Primary Mid`.

**Lists:**
- Interactive list items should have a 12px radius on hover/active states. Use `Neutral` for dividers at 20% opacity.