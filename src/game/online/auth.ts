import { createClient, type Session, type SupabaseClient, type User } from '@supabase/supabase-js';

export type AuthStatus = 'offline' | 'loading' | 'authenticated' | 'signed_out' | 'error';
export type AuthState = Readonly<{
  status: AuthStatus;
  user: Readonly<User> | null;
  message: string;
  configured: boolean;
}>;

export type AuthConfig = Readonly<{ url: string; anonKey: string }>;

export function readAuthConfig(env: Record<string, unknown> = ((import.meta as ImportMeta & { env?: Record<string, unknown> }).env ?? {})): AuthConfig | null {
  const url = typeof env.VITE_SUPABASE_URL === 'string' ? env.VITE_SUPABASE_URL.trim() : '';
  const anonKey = typeof env.VITE_SUPABASE_ANON_KEY === 'string' ? env.VITE_SUPABASE_ANON_KEY.trim() : '';
  if (!url || !anonKey || !/^https:\/\//i.test(url)) return null;
  return Object.freeze({ url, anonKey });
}

export function validateCredentials(email: string, password: string): string | null {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return 'Vui lòng nhập email hợp lệ.';
  if (password.length < 6) return 'Mật khẩu cần có ít nhất 6 ký tự.';
  return null;
}

function userMessage(error: unknown): string {
  const text = error instanceof Error ? error.message.toLowerCase() : '';
  if (text.includes('invalid login') || text.includes('invalid credentials')) return 'Email hoặc mật khẩu chưa đúng.';
  if (text.includes('already registered') || text.includes('user already')) return 'Email này đã được đăng ký.';
  if (text.includes('rate limit')) return 'Bạn thử lại sau ít phút.';
  return 'Không thể hoàn tất xác thực. Vui lòng thử lại.';
}

export class AuthStore {
  readonly config: AuthConfig | null;
  readonly client: SupabaseClient | null;
  private state: AuthState;
  private listeners = new Set<(state: AuthState) => void>();
  private unsubscribe: (() => void) | undefined;

  constructor(config: AuthConfig | null = readAuthConfig()) {
    this.config = config;
    this.client = config ? createClient(config.url, config.anonKey) : null;
    this.state = Object.freeze({ status: config ? 'loading' : 'offline', user: null, message: config ? '' : 'Đăng nhập tạm tắt: thiếu cấu hình Supabase. Bạn vẫn có thể chơi offline.', configured: !!config });
    if (this.client) {
      this.client.auth.getSession().then(({ data, error }) => this.applySession(data.session, error));
      const { data } = this.client.auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_OUT') this.setState({ status: 'signed_out', user: null, message: '', configured: true });
        else this.applySession(session, null);
      });
      this.unsubscribe = () => data.subscription.unsubscribe();
    }
  }

  get snapshot(): AuthState { return this.state; }
  subscribe(listener: (state: AuthState) => void): () => void { this.listeners.add(listener); listener(this.state); return () => this.listeners.delete(listener); }

  async signUp(email: string, password: string): Promise<AuthState> {
    const validationError = validateCredentials(email, password);
    if (validationError) {
      this.setState({ status: 'error', message: validationError });
      return this.state;
    }
    return this.runAuth(() => this.client!.auth.signUp({ email: email.trim(), password }));
  }
  async signInWithPassword(email: string, password: string): Promise<AuthState> {
    const validationError = validateCredentials(email, password);
    if (validationError) {
      this.setState({ status: 'error', message: validationError });
      return this.state;
    }
    return this.runAuth(() => this.client!.auth.signInWithPassword({ email: email.trim(), password }));
  }
  async signOut(): Promise<AuthState> {
    if (!this.client) return this.state;
    this.setState({ status: 'loading', message: '' });
    const { error } = await this.client.auth.signOut();
    if (error) this.setState({ status: 'error', message: userMessage(error) });
    return this.state;
  }
  async refreshSession(): Promise<AuthState> {
    if (!this.client) return this.state;
    const { data, error } = await this.client.auth.refreshSession();
    this.applySession(data.session, error);
    return this.state;
  }
  destroy(): void { this.unsubscribe?.(); this.listeners.clear(); }

  private async runAuth(action: () => Promise<{ data: { session: Session | null }; error: { message: string } | null }>): Promise<AuthState> {
    if (!this.client) return this.state;
    this.setState({ status: 'loading', message: '' });
    try {
      const { data, error } = await action();
      this.applySession(data.session, error);
    } catch (error) { this.setState({ status: 'error', message: userMessage(error) }); }
    return this.state;
  }
  private applySession(session: Session | null, error: unknown): void {
    this.setState(error ? { status: 'error', message: userMessage(error) } : { status: session?.user ? 'authenticated' : 'signed_out', user: session?.user ?? null, message: session ? 'Đã kết nối tài khoản.' : '' });
  }
  private setState(next: Partial<AuthState>): void {
    this.state = Object.freeze({ ...this.state, ...next });
    for (const listener of this.listeners) listener(this.state);
  }
}

export const authStore = new AuthStore();
