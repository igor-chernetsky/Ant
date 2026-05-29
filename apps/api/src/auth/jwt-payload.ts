export interface JwtPayload {
  sub: string;
  email?: string;
  preferred_username?: string;
  name?: string;
  realm_access?: {
    roles?: string[];
  };
}
