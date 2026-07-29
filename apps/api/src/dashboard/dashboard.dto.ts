import { IsString, MaxLength } from 'class-validator';

/** Body for `POST /dashboard/reveal` — the widget/scope whose masked figures are being unmasked. */
export class RevealDto {
  @IsString()
  @MaxLength(64)
  scope!: string;
}
