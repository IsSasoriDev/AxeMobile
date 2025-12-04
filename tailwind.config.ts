import type { Config } from "tailwindcss";

export default {
	darkMode: ["class"],
	content: [
		"./pages/**/*.{ts,tsx}",
		"./components/**/*.{ts,tsx}",
		"./app/**/*.{ts,tsx}",
		"./src/**/*.{ts,tsx}",
	],
	prefix: "",
	theme: {
		container: {
			center: true,
			padding: '2rem',
			screens: {
				'2xl': '1400px'
			}
		},
		extend: {
			colors: {
				border: 'hsl(var(--border))',
				input: 'hsl(var(--input))',
				ring: 'hsl(var(--ring))',
				background: 'hsl(var(--background))',
				foreground: 'hsl(var(--foreground))',
				primary: {
					DEFAULT: 'hsl(var(--primary))',
					foreground: 'hsl(var(--primary-foreground))'
				},
				secondary: {
					DEFAULT: 'hsl(var(--secondary))',
					foreground: 'hsl(var(--secondary-foreground))'
				},
				destructive: {
					DEFAULT: 'hsl(var(--destructive))',
					foreground: 'hsl(var(--destructive-foreground))'
				},
				muted: {
					DEFAULT: 'hsl(var(--muted))',
					foreground: 'hsl(var(--muted-foreground))'
				},
				accent: {
					DEFAULT: 'hsl(var(--accent))',
					foreground: 'hsl(var(--accent-foreground))'
				},
				popover: {
					DEFAULT: 'hsl(var(--popover))',
					foreground: 'hsl(var(--popover-foreground))'
				},
				card: {
					DEFAULT: 'hsl(var(--card))',
					foreground: 'hsl(var(--card-foreground))'
				},
				success: 'hsl(var(--success))',
				warning: 'hsl(var(--warning))',
				info: 'hsl(var(--info))',
				sidebar: {
					DEFAULT: 'hsl(var(--sidebar-background))',
					foreground: 'hsl(var(--sidebar-foreground))',
					primary: 'hsl(var(--sidebar-primary))',
					'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
					accent: 'hsl(var(--sidebar-accent))',
					'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
					border: 'hsl(var(--sidebar-border))',
					ring: 'hsl(var(--sidebar-ring))'
				}
			},
			borderRadius: {
				lg: 'var(--radius)',
				md: 'calc(var(--radius) - 2px)',
				sm: 'calc(var(--radius) - 4px)'
			},
			keyframes: {
				'accordion-down': {
					from: { height: '0', opacity: '0' },
					to: { height: 'var(--radix-accordion-content-height)', opacity: '1' }
				},
				'accordion-up': {
					from: { height: 'var(--radix-accordion-content-height)', opacity: '1' },
					to: { height: '0', opacity: '0' }
				},
				'slide-up': {
					'0%': { transform: 'translateY(20px)', opacity: '0' },
					'100%': { transform: 'translateY(0)', opacity: '1' }
				},
				'slide-down': {
					'0%': { transform: 'translateY(-20px)', opacity: '0' },
					'100%': { transform: 'translateY(0)', opacity: '1' }
				},
				'slide-left': {
					'0%': { transform: 'translateX(20px)', opacity: '0' },
					'100%': { transform: 'translateX(0)', opacity: '1' }
				},
				'slide-right': {
					'0%': { transform: 'translateX(-20px)', opacity: '0' },
					'100%': { transform: 'translateX(0)', opacity: '1' }
				},
				'scale-up': {
					'0%': { transform: 'scale(0.95)', opacity: '0' },
					'100%': { transform: 'scale(1)', opacity: '1' }
				},
				'fade-in': {
					'0%': { opacity: '0' },
					'100%': { opacity: '1' }
				},
				'bounce-in': {
					'0%': { transform: 'scale(0.3)', opacity: '0' },
					'50%': { transform: 'scale(1.02)' },
					'70%': { transform: 'scale(0.98)' },
					'100%': { transform: 'scale(1)', opacity: '1' }
				},
				'flip-in': {
					'0%': { transform: 'perspective(400px) rotateX(-90deg)', opacity: '0' },
					'40%': { transform: 'perspective(400px) rotateX(10deg)' },
					'70%': { transform: 'perspective(400px) rotateX(-5deg)' },
					'100%': { transform: 'perspective(400px) rotateX(0deg)', opacity: '1' }
				},
				'glow-pulse': {
					'0%, 100%': { boxShadow: '0 0 20px hsl(var(--primary) / 0.5)' },
					'50%': { boxShadow: '0 0 40px hsl(var(--primary) / 0.8), 0 0 60px hsl(var(--primary) / 0.4)' }
				},
				'float': {
					'0%, 100%': { transform: 'translateY(0px)' },
					'50%': { transform: 'translateY(-6px)' }
				},
				'collapsible-down': {
					from: { height: '0', opacity: '0' },
					to: { height: 'var(--radix-collapsible-content-height)', opacity: '1' }
				},
				'collapsible-up': {
					from: { height: 'var(--radix-collapsible-content-height)', opacity: '1' },
					to: { height: '0', opacity: '0' }
				}
			},
			animation: {
				'accordion-down': 'accordion-down 0.25s cubic-bezier(0.32, 0.72, 0, 1)',
				'accordion-up': 'accordion-up 0.25s cubic-bezier(0.32, 0.72, 0, 1)',
				'pulse-glow': 'pulse-glow 2s infinite',
				'spin-slow': 'spin 3s linear infinite',
				'slide-up': 'slide-up 0.35s cubic-bezier(0.32, 0.72, 0, 1)',
				'slide-down': 'slide-down 0.35s cubic-bezier(0.32, 0.72, 0, 1)',
				'slide-left': 'slide-left 0.35s cubic-bezier(0.32, 0.72, 0, 1)',
				'slide-right': 'slide-right 0.35s cubic-bezier(0.32, 0.72, 0, 1)',
				'scale-up': 'scale-up 0.25s cubic-bezier(0.32, 0.72, 0, 1)',
				'fade-in': 'fade-in 0.3s ease-out',
				'bounce-in': 'bounce-in 0.5s cubic-bezier(0.32, 0.72, 0, 1)',
				'flip-in': 'flip-in 0.5s cubic-bezier(0.32, 0.72, 0, 1)',
				'glow-pulse': 'glow-pulse 2s ease-in-out infinite',
				'float': 'float 3s ease-in-out infinite',
				'collapsible-down': 'collapsible-down 0.3s cubic-bezier(0.32, 0.72, 0, 1)',
				'collapsible-up': 'collapsible-up 0.3s cubic-bezier(0.32, 0.72, 0, 1)'
			},
			backgroundImage: {
				'gradient-primary': 'var(--gradient-primary)',
				'gradient-accent': 'var(--gradient-accent)'
			},
			boxShadow: {
				'glow': 'var(--shadow-glow)',
				'card': 'var(--shadow-card)'
			}
		}
	},
	plugins: [require("tailwindcss-animate")],
} satisfies Config;
