export default interface Translations {
	volume (volume: number): string;
	chapter (chapter: number): string;
	page (page: number): string;
	back (): string;
	remove (): string;
	"previous-page" (): string;
	"next-page" (): string;
	title (location?: { root?: string; volume?: string; chapter?: string; page?: string }): string;
	"confirm-remove-character" (name: string): string;
}
