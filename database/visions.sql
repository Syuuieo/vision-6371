CREATE TABLE app.visions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  title text NOT NULL,
  sender text NOT NULL,
  city text NOT NULL,
  thumbnail text NOT NULL,
  particles text NOT NULL,
  ambience text NOT NULL,
  has_voice boolean NOT NULL DEFAULT false,
  temp_c integer NOT NULL,
  wind_level integer NOT NULL,
  scent_tag text NOT NULL DEFAULT '',
  visibility text NOT NULL DEFAULT 'public',
  hearts integer NOT NULL DEFAULT 0,
  owner_token text,
  created_at timestamptz NOT NULL DEFAULT now(),
  packet jsonb NOT NULL
);
CREATE INDEX visions_public_created_at_idx ON app.visions (visibility, created_at);
CREATE INDEX visions_public_hearts_idx ON app.visions (visibility, hearts);
CREATE TABLE app.vision_echoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vision_id uuid NOT NULL REFERENCES app.visions (id),
  message text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX vision_echoes_vision_created_at_idx ON app.vision_echoes (vision_id, created_at);