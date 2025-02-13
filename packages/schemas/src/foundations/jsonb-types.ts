import { hexColorRegEx, languageKeys } from '@logto/shared';
import { z } from 'zod';

/**
 * Commonly Used
 */

// Cannot declare `z.object({}).catchall(z.unknown().optional())` to guard `{ [key: string]?: unknown }` (invalid type),
// so do it another way to guard `{ [x: string]: unknown; } | {}`.
export const arbitraryObjectGuard = z.union([z.object({}).catchall(z.unknown()), z.object({})]);

export type ArbitraryObject = z.infer<typeof arbitraryObjectGuard>;

/**
 * OIDC Model Instances
 */

export const oidcModelInstancePayloadGuard = z
  .object({
    userCode: z.string().optional(),
    uid: z.string().optional(),
    grantId: z.string().optional(),
  })
  /**
   * Try to use `.passthrough()` if type has been fixed.
   * https://github.com/colinhacks/zod/issues/452
   */
  .catchall(z.unknown());

export type OidcModelInstancePayload = z.infer<typeof oidcModelInstancePayloadGuard>;

export const oidcClientMetadataGuard = z.object({
  redirectUris: z.string().url().array(),
  postLogoutRedirectUris: z.string().url().array(),
  logoUri: z.string().optional(),
});

export type OidcClientMetadata = z.infer<typeof oidcClientMetadataGuard>;

export enum CustomClientMetadataKey {
  CorsAllowedOrigins = 'corsAllowedOrigins',
  IdTokenTtl = 'idTokenTtl',
  RefreshTokenTtl = 'refreshTokenTtl',
}

export const customClientMetadataGuard = z.object({
  [CustomClientMetadataKey.CorsAllowedOrigins]: z.string().url().array().optional(),
  [CustomClientMetadataKey.IdTokenTtl]: z.number().optional(),
  [CustomClientMetadataKey.RefreshTokenTtl]: z.number().optional(),
});

export type CustomClientMetadata = z.infer<typeof customClientMetadataGuard>;

/**
 * Users
 */
export const roleNamesGuard = z.string().array();

export type RoleNames = z.infer<typeof roleNamesGuard>;

const identityGuard = z.object({
  userId: z.string(),
  details: z.object({}).optional(), // Connector's userinfo details, schemaless
});
export const identitiesGuard = z.record(identityGuard);

export type Identity = z.infer<typeof identityGuard>;
export type Identities = z.infer<typeof identitiesGuard>;

/**
 * SignIn Experiences
 */

export const colorGuard = z.object({
  primaryColor: z.string().regex(hexColorRegEx),
  isDarkModeEnabled: z.boolean(),
  darkPrimaryColor: z.string().regex(hexColorRegEx),
});

export type Color = z.infer<typeof colorGuard>;

export enum BrandingStyle {
  Logo = 'Logo',
  Logo_Slogan = 'Logo_Slogan',
}

export const brandingGuard = z.object({
  style: z.nativeEnum(BrandingStyle),
  logoUrl: z.string().url(),
  darkLogoUrl: z.string().url().optional(),
  slogan: z.string().optional(),
});

export type Branding = z.infer<typeof brandingGuard>;

export const termsOfUseGuard = z.object({
  enabled: z.boolean(),
  contentUrl: z.string().url().optional().or(z.literal('')),
});

export type TermsOfUse = z.infer<typeof termsOfUseGuard>;

export const languageInfoGuard = z.object({
  autoDetect: z.boolean(),
  fallbackLanguage: z.enum(languageKeys),
  fixedLanguage: z.enum(languageKeys),
});

export type LanguageInfo = z.infer<typeof languageInfoGuard>;

export enum SignInMethodKey {
  Username = 'username',
  Email = 'email',
  Sms = 'sms',
  Social = 'social',
}

export enum SignInMethodState {
  Primary = 'primary',
  Secondary = 'secondary',
  Disabled = 'disabled',
}

export const signInMethodsGuard = z.object({
  [SignInMethodKey.Username]: z.nativeEnum(SignInMethodState),
  [SignInMethodKey.Email]: z.nativeEnum(SignInMethodState),
  [SignInMethodKey.Sms]: z.nativeEnum(SignInMethodState),
  [SignInMethodKey.Social]: z.nativeEnum(SignInMethodState),
});

export type SignInMethods = z.infer<typeof signInMethodsGuard>;

export const connectorTargetsGuard = z.string().array();

export type ConnectorTargets = z.infer<typeof connectorTargetsGuard>;

/**
 * Settings
 */

export enum AppearanceMode {
  SyncWithSystem = 'system',
  LightMode = 'light',
  DarkMode = 'dark',
}

export const adminConsoleConfigGuard = z.object({
  // Get started challenges
  demoChecked: z.boolean(),
  applicationCreated: z.boolean(),
  signInExperienceCustomized: z.boolean(),
  passwordlessConfigured: z.boolean(),
  socialSignInConfigured: z.boolean(),
  furtherReadingsChecked: z.boolean(),
});

export type AdminConsoleConfig = z.infer<typeof adminConsoleConfigGuard>;
