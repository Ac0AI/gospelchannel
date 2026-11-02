-- FTS5 folds Unicode case, unlike SQLite's ASCII-only LIKE operator.
CREATE VIRTUAL TABLE churches_search USING fts5(
  name, description, country, location, denomination, music_style, aliases,
  content='churches', content_rowid='rowid', tokenize='trigram'
);
INSERT INTO churches_search(churches_search) VALUES ('rebuild');
CREATE TRIGGER churches_text_insert AFTER INSERT ON churches BEGIN
  INSERT INTO churches_search(rowid, name, description, country, location, denomination, music_style, aliases)
  VALUES (NEW.rowid, NEW.name, NEW.description, NEW.country, NEW.location, NEW.denomination, NEW.music_style, NEW.aliases);
END;
CREATE TRIGGER churches_text_delete AFTER DELETE ON churches BEGIN
  INSERT INTO churches_search(churches_search, rowid, name, description, country, location, denomination, music_style, aliases)
  VALUES ('delete', OLD.rowid, OLD.name, OLD.description, OLD.country, OLD.location, OLD.denomination, OLD.music_style, OLD.aliases);
END;
CREATE TRIGGER churches_text_update AFTER UPDATE OF name, description, country, location, denomination, music_style, aliases ON churches BEGIN
  INSERT INTO churches_search(churches_search, rowid, name, description, country, location, denomination, music_style, aliases)
  VALUES ('delete', OLD.rowid, OLD.name, OLD.description, OLD.country, OLD.location, OLD.denomination, OLD.music_style, OLD.aliases);
  INSERT INTO churches_search(rowid, name, description, country, location, denomination, music_style, aliases)
  VALUES (NEW.rowid, NEW.name, NEW.description, NEW.country, NEW.location, NEW.denomination, NEW.music_style, NEW.aliases);
END;
