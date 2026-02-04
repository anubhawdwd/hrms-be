//    AUTH - LOCAL LOGIN
export interface LoginDTO {
    email: string;
    password: string;
}

//    AUTH - GOOGLE LOGIN
export interface GoogleLoginDTO {
    idToken: string;   // token from frontend
}

//    AUTH - MICROSOFT LOGIN
export interface MicrosoftLoginDTO {
    accessToken: string;   // token from frontend
}

//    TOKEN REFRESH
export interface RefreshTokenDTO {
    refreshToken: string;
}