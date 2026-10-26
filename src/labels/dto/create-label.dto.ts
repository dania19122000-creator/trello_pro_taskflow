import { IsNotEmpty, IsString, Matches, MaxLength } from "class-validator";


export class CreateLabelDto {
    @IsNotEmpty({ message: 'Name is require' })
    @IsString({ message: 'Name must be a string' })
    @MaxLength(50, { message: 'Name must be at most 50 characters' })
    name!: string;


    @IsNotEmpty({ message: 'Color is required' })
    @IsString({ message: 'Name must be a string' })
    @Matches(/^#[0-9A-Fa-f]{6}$/, {
    message: 'Color must be a valid hex color (e.g., #FF5733)',
  })
  color!: string;

}