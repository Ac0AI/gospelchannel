-- Apply after the source snapshot has been imported and verified.
-- A trigger keeps review, canonical name and enrichment in one transaction.
CREATE TRIGGER approved_profile_name
AFTER UPDATE OF review_status ON church_profile_edits
WHEN OLD.review_status = 'pending' AND NEW.review_status = 'approved' AND NEW.field_name = 'name'
BEGIN
  UPDATE churches
  SET name = json_extract(NEW.field_value, '$'), updated_at = unixepoch() * 1000
  WHERE slug = NEW.church_slug;
  UPDATE church_enrichments
  SET official_church_name = json_extract(NEW.field_value, '$')
  WHERE church_slug = NEW.church_slug;
END;
