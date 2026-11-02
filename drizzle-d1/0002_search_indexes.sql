-- Apply after importing and verifying the source snapshot.
CREATE INDEX search_suggestions_prefix_nocase ON search_suggestions(search_key COLLATE NOCASE);
CREATE VIRTUAL TABLE search_suggestions_words USING fts5(search_key, content='search_suggestions', content_rowid='rowid', tokenize='unicode61 remove_diacritics 0');
CREATE VIRTUAL TABLE search_suggestions_trigrams USING fts5(search_key, content='search_suggestions', content_rowid='rowid', tokenize='trigram');
INSERT INTO search_suggestions_words(search_suggestions_words) VALUES ('rebuild');
INSERT INTO search_suggestions_trigrams(search_suggestions_trigrams) VALUES ('rebuild');

CREATE TRIGGER search_suggestions_fts_insert AFTER INSERT ON search_suggestions BEGIN
  INSERT INTO search_suggestions_words(rowid, search_key) VALUES (NEW.rowid, NEW.search_key);
  INSERT INTO search_suggestions_trigrams(rowid, search_key) VALUES (NEW.rowid, NEW.search_key);
END;
CREATE TRIGGER search_suggestions_fts_delete AFTER DELETE ON search_suggestions BEGIN
  INSERT INTO search_suggestions_words(search_suggestions_words, rowid, search_key) VALUES ('delete', OLD.rowid, OLD.search_key);
  INSERT INTO search_suggestions_trigrams(search_suggestions_trigrams, rowid, search_key) VALUES ('delete', OLD.rowid, OLD.search_key);
END;
CREATE TRIGGER search_suggestions_fts_update AFTER UPDATE ON search_suggestions BEGIN
  INSERT INTO search_suggestions_words(search_suggestions_words, rowid, search_key) VALUES ('delete', OLD.rowid, OLD.search_key);
  INSERT INTO search_suggestions_trigrams(search_suggestions_trigrams, rowid, search_key) VALUES ('delete', OLD.rowid, OLD.search_key);
  INSERT INTO search_suggestions_words(rowid, search_key) VALUES (NEW.rowid, NEW.search_key);
  INSERT INTO search_suggestions_trigrams(rowid, search_key) VALUES (NEW.rowid, NEW.search_key);
END;

CREATE TRIGGER churches_search_insert AFTER INSERT ON churches BEGIN
  INSERT INTO search_suggestions (suggestion_key, target_type, target_id, title, subtitle, slug, search_key, popularity, updated_at)
  SELECT 'church:' || NEW.slug || ':' || source_key, 'church', NEW.slug, NEW.name,
    nullif(trim(trim(coalesce(NEW.location, '')) || CASE WHEN trim(coalesce(NEW.location,'')) <> '' AND trim(coalesce(NEW.country,'')) <> '' THEN ', ' ELSE '' END || trim(coalesce(NEW.country,''))), ''), NEW.slug, lower(value), ((coalesce(json_array_length(NEW.spotify_playlist_ids), 0) + coalesce(json_array_length(NEW.additional_playlists), 0)) * 10 + CASE WHEN coalesce(NEW.spotify_url,'') <> '' THEN 15 ELSE 0 END + CASE WHEN NEW.verified_at IS NOT NULL THEN 20 ELSE 0 END + CASE WHEN coalesce(NEW.header_image,'') <> '' OR coalesce(NEW.logo,'') <> '' THEN 8 ELSE 0 END) + source_score, unixepoch() * 1000
  FROM (
    WITH RECURSIVE source(source_key, value, source_score) AS (
      SELECT json_extract(value, '$.key'), json_extract(value, '$.text'), json_extract(value, '$.score')
      FROM json_each(json_array(
        json_object('key', 'name', 'text', NEW.name, 'score', 100),
        json_object('key', 'name_city', 'text', CASE WHEN nullif(trim(substr(NEW.location, 1, instr(NEW.location || ',', ',') - 1)), '') IS NOT NULL AND instr(lower(NEW.name), lower(nullif(trim(substr(NEW.location, 1, instr(NEW.location || ',', ',') - 1)), ''))) = 0 THEN NEW.name || ' ' || nullif(trim(substr(NEW.location, 1, instr(NEW.location || ',', ',') - 1)), '') END, 'score', 95),
        json_object('key', 'city', 'text', nullif(trim(substr(NEW.location, 1, instr(NEW.location || ',', ',') - 1)), ''), 'score', 80),
        json_object('key', 'country', 'text', NEW.country, 'score', 45),
        json_object('key', 'denomination', 'text', NEW.denomination, 'score', 35)
      ))
      UNION ALL SELECT 'alias:' || (CAST(key AS INTEGER) + 1), value, 90 FROM json_each(NEW.aliases)
    ), normalized(source_key, value, source_score) AS (
      SELECT source_key, trim(replace(replace(replace(value, char(9), ' '), char(10), ' '), char(13), ' ')), source_score FROM source
      UNION ALL SELECT source_key, replace(value, '  ', ' '), source_score FROM normalized WHERE instr(value, '  ') > 0
    ) SELECT source_key, value, source_score FROM normalized WHERE instr(value, '  ') = 0
  ) WHERE NEW.status = 'approved' AND nullif(value, '') IS NOT NULL;
END;
CREATE TRIGGER churches_search_update AFTER UPDATE OF slug, name, country, location, denomination, aliases, status, spotify_playlist_ids, additional_playlists, spotify_url, header_image, logo, verified_at ON churches BEGIN
  DELETE FROM search_suggestions WHERE target_type = 'church' AND target_id IN (OLD.slug, NEW.slug);
  INSERT INTO search_suggestions (suggestion_key, target_type, target_id, title, subtitle, slug, search_key, popularity, updated_at)
  SELECT 'church:' || NEW.slug || ':' || source_key, 'church', NEW.slug, NEW.name,
    nullif(trim(trim(coalesce(NEW.location, '')) || CASE WHEN trim(coalesce(NEW.location,'')) <> '' AND trim(coalesce(NEW.country,'')) <> '' THEN ', ' ELSE '' END || trim(coalesce(NEW.country,''))), ''), NEW.slug, lower(value), ((coalesce(json_array_length(NEW.spotify_playlist_ids), 0) + coalesce(json_array_length(NEW.additional_playlists), 0)) * 10 + CASE WHEN coalesce(NEW.spotify_url,'') <> '' THEN 15 ELSE 0 END + CASE WHEN NEW.verified_at IS NOT NULL THEN 20 ELSE 0 END + CASE WHEN coalesce(NEW.header_image,'') <> '' OR coalesce(NEW.logo,'') <> '' THEN 8 ELSE 0 END) + source_score, unixepoch() * 1000
  FROM (
    WITH RECURSIVE source(source_key, value, source_score) AS (
      SELECT json_extract(value, '$.key'), json_extract(value, '$.text'), json_extract(value, '$.score')
      FROM json_each(json_array(
        json_object('key', 'name', 'text', NEW.name, 'score', 100),
        json_object('key', 'name_city', 'text', CASE WHEN nullif(trim(substr(NEW.location, 1, instr(NEW.location || ',', ',') - 1)), '') IS NOT NULL AND instr(lower(NEW.name), lower(nullif(trim(substr(NEW.location, 1, instr(NEW.location || ',', ',') - 1)), ''))) = 0 THEN NEW.name || ' ' || nullif(trim(substr(NEW.location, 1, instr(NEW.location || ',', ',') - 1)), '') END, 'score', 95),
        json_object('key', 'city', 'text', nullif(trim(substr(NEW.location, 1, instr(NEW.location || ',', ',') - 1)), ''), 'score', 80),
        json_object('key', 'country', 'text', NEW.country, 'score', 45),
        json_object('key', 'denomination', 'text', NEW.denomination, 'score', 35)
      ))
      UNION ALL SELECT 'alias:' || (CAST(key AS INTEGER) + 1), value, 90 FROM json_each(NEW.aliases)
    ), normalized(source_key, value, source_score) AS (
      SELECT source_key, trim(replace(replace(replace(value, char(9), ' '), char(10), ' '), char(13), ' ')), source_score FROM source
      UNION ALL SELECT source_key, replace(value, '  ', ' '), source_score FROM normalized WHERE instr(value, '  ') > 0
    ) SELECT source_key, value, source_score FROM normalized WHERE instr(value, '  ') = 0
  ) WHERE NEW.status = 'approved' AND nullif(value, '') IS NOT NULL;
END;
CREATE TRIGGER churches_search_delete AFTER DELETE ON churches BEGIN
  DELETE FROM search_suggestions WHERE target_type = 'church' AND target_id = OLD.slug;
END;
