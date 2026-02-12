//    AUTH - LOCAL LOGIN
export interface LoginDTO {
    email: string;
    password: string;
    userAgent?: string
    ipAddress?: string
}

//    AUTH - GOOGLE LOGIN
export interface GoogleLoginDTO {
    idToken: string;   // token from frontend
    userAgent?: string
    ipAddress?: string
}

//    AUTH - MICROSOFT LOGIN
export interface MicrosoftLoginDTO {
    accessToken: string;   // token from frontend
    userAgent?: string
    ipAddress?: string
}

//    TOKEN REFRESH
export interface RefreshTokenDTO {
    refreshToken: string;
    userAgent?: string
    ipAddress?: string
}