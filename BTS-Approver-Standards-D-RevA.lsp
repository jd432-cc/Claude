;;; ==================================================================
;;;  BTS-Approver-Standards-D-RevA.lsp
;;;  BTS Enterprise Standards Suite : Approver Standards D, Revision A
;;;
;;;  Self contained. This file carries the BTS layer register and the
;;;  release R v1.1 commands as well as the approver suite, so it is
;;;  the only file to load:
;;;
;;;      (load "BTS-Approver-Standards-D-RevA")
;;;
;;;  Everything from release R is here unchanged and under the same
;;;  names, so existing scripts, macros and toolbar buttons keep
;;;  working. BTSStandards.lsp does not need to be loaded; loading it
;;;  as well is harmless but pointless, and leaves the register in two
;;;  places to drift apart.
;;;
;;;  AutoCAD LT 2024+ safe. Entity level AutoLISP throughout - no
;;;  ActiveX, no vla-*, no ObjectDBX. LT cannot side-load a second
;;;  drawing database, so everything that has to visit other drawings
;;;  (the BATCH and PROJECT commands) writes a script for SCRIPT to run
;;;  and gathers the results through a shared CSV log.
;;;
;;;  COMMANDS
;;;    Register       BTSCHECK BTSFIX BTSREMAP BTSVARS BTSJUNK
;;;                   BTSOVERRIDE BTSREPORT BTSHELP
;;;    Advanced       BTSLAYERS BTSCLEAN BTSAUDIT BTSRECOVER BTSPURGE
;;;                   BTSPLOTCHECK BTSTITLECHECK BTSDWGINFO BTSUNITS
;;;    CAD manager    BTSBATCHCHECK BTSBATCHFIX BTSEXPORTCSV
;;;                   BTSEXPORTJSON BTSSTATS BTSCOMPARE
;;;    Utility survey BTSUTILCHECK BTSLTYPECHECK BTSQLCHECK BTSCONFLICTS
;;;    GIS            BTSBNGCHECK BTSGRIDCHECK BTSCOORDS
;;;    Sheets         BTSSHEETCHECK BTSLAYOUTCHECK BTSVIEWPORTS
;;;                   BTSVPLOCK BTSVPFREEZE
;;;    Blocks         BTSBLOCKCHECK BTSBLOCKPURGE BTSBLOCKREPORT
;;;    Annotation     BTSTEXTCHECK BTSDIMCHECK BTSMLEADERCHECK
;;;    Auto-fix       BTSAUTOFIX BTSAUTOREMAP BTSAUTOCLEAN
;;;    Enterprise     BTSPROJECTAUDIT BTSPROJECTREPORT BTSPACKAGE
;;;                   BTSCOMPLETECHECK
;;;    Help           BTSHELP BTSAHELP
;;;
;;;  Read only : BTSCHECK, BTSJUNK, BTSOVERRIDE, BTSREPORT, every
;;;              *CHECK, BTSAUDIT, BTSSTATS, BTSDWGINFO, BTSCOORDS,
;;;              BTSBLOCKREPORT, BTSEXPORT*, BTSCOMPARE, BTSPROJECT*,
;;;              BTSBATCHCHECK.
;;;  Modifies  : BTSFIX BTSREMAP BTSVARS BTSLAYERS BTSCLEAN BTSPURGE
;;;              BTSRECOVER BTSUNITS BTSVPLOCK BTSVPFREEZE
;;;              BTSBLOCKPURGE BTSAUTOFIX BTSAUTOREMAP BTSAUTOCLEAN
;;;              BTSBATCHFIX. Work on a copy.
;;; ==================================================================

(vl-load-com)

(setq *BTS-STD-VERSION* "Layer Standard - Release v1.1")
(setq *BTS-A-VERSION* "Approver Standards D - Rev A")


;;; ==================================================================
;;;  PART 1 - THE REGISTER
;;;  The standards data tables. Site policy for the approver suite
;;;  lives in the *BTS-A-* tables in part 4; this is the standard
;;;  itself, and it is the only copy.
;;; ==================================================================

;;; ---- Register: (name colour linetype lineweight plot transp description)
;;;      lineweight in hundredths of a mm; -3 = Default
(setq *BTS-LAYERS* '(
  ("BTS-A-ANNO-DimsLeaders" 32 "Continuous" 13 1 0 "Dimensions.")
  ("BTS-A-ANNO-Notes" 32 "Continuous" 18 1 0 "Standing notes, caveats, PAS 128 statement.")
  ("BTS-A-ANNO-QL" 6 "Continuous" 18 1 0 "PAS 128 quality level annotation.")
  ("BTS-A-ANNO-Text" 7 "Continuous" 18 1 0 "General notes.")
  ("BTS-A-ANNO-TextNonPlot" 7 "Continuous" 18 1 0 "General notes you don't want plotted.")
  ("BTS-L-Draft" 7 "Continuous" 35 1 90 "DRAFT / PRELIMINARY watermark. Must be frozen on issue.")
  ("BTS-L-Key" 7 "Continuous" 18 1 0 "Key / legend content ONLY. Don't place title blocks here.")
  ("BTS-L-NonPlotted" 6 "Continuous" -3 0 0 "Any construction lines, setting out, working geometry.")
  ("BTS-L-PageBlock" 7 "Continuous" 25 1 0 "Sheet borders, title blocks, revision tables.")
  ("BTS-L-VPort" 5 "Continuous" 13 1 0 "Viewport borders that ARE to be plotted.")
  ("BTS-L-VPortNonPlot" 200 "Continuous" -3 0 0 "Viewport borders NOT to be plotted. Default for viewports.")
  ("BTS-S-BMap" 9 "Continuous" 9 1 0 "Non-OS base mapping.")
  ("BTS-S-Boundary" 1 "Continuous" 53 1 0 "Site / development boundary (red, heavy polyline).")
  ("BTS-S-Buildings" 8 "Continuous" 13 1 0 "Buildings.")
  ("BTS-S-Grid" 8 "Continuous" 5 1 0 "OSGB grid and Easting/Northing labels.")
  ("BTS-S-Levels" 9 "Continuous" 9 1 0 "Spot levels and contours (ODN).")
  ("BTS-S-Photo" 8 "Continuous" 5 1 0 "Aerial imagery / GEOMAP capture. Indicative only.")
  ("BTS-S-Roads" 8 "Continuous" 9 1 0 "Highway edges, kerb lines, footways.")
  ("BTS-U-COMM-Apparatus" 7 "Continuous" 25 1 0 "COMMS: service run, plus chambers, poles, pylons, valves, hydrants and cabinets.")
  ("BTS-U-COMM-Easement" 7 "Continuous" 18 1 0 "COMMS: legal easement / wayleave extent.")
  ("BTS-U-COMM-Label" 7 "Continuous" 18 1 0 "COMMS: text, leaders and callouts.")
  ("BTS-U-COMM-StandOff" 7 "Continuous" 18 1 0 "COMMS: Operator stand-off zone boundary.")
  ("BTS-U-COMM-StandOff-Hatch" 7 "Continuous" 5 1 70 "COMMS: stand-off zone hatch fill. 70% transparent.")
  ("BTS-U-ELEC-Apparatus" 7 "Continuous" 25 1 0 "ELEC: service run, plus chambers, poles, pylons, valves, hydrants and cabinets.")
  ("BTS-U-ELEC-Easement" 7 "Continuous" 18 1 0 "ELEC: legal easement / wayleave extent.")
  ("BTS-U-ELEC-Label" 7 "Continuous" 18 1 0 "ELEC: text, leaders and callouts.")
  ("BTS-U-ELEC-StandOff" 7 "Continuous" 18 1 0 "ELEC: Operator stand-off zone boundary.")
  ("BTS-U-ELEC-StandOff-Hatch" 7 "Continuous" 5 1 70 "ELEC: stand-off zone hatch fill. 70% transparent.")
  ("BTS-U-FOUL-Apparatus" 7 "Continuous" 25 1 0 "FOUL: service run, plus chambers, poles, pylons, valves, hydrants and cabinets.")
  ("BTS-U-FOUL-Easement" 7 "Continuous" 18 1 0 "FOUL: legal easement / wayleave extent.")
  ("BTS-U-FOUL-Easement-Hatch" 7 "Continuous" 5 1 70 "FOUL: easement extent hatch fill. 70% transparent.")
  ("BTS-U-FOUL-Label" 7 "Continuous" 18 1 0 "FOUL: text, leaders and callouts.")
  ("BTS-U-FUEL-Apparatus" 7 "Continuous" 25 1 0 "FUEL: service run, plus chambers, poles, pylons, valves, hydrants and cabinets.")
  ("BTS-U-FUEL-Easement" 7 "Continuous" 18 1 0 "FUEL: legal easement / wayleave extent.")
  ("BTS-U-FUEL-Easement-Hatch" 7 "Continuous" 5 1 70 "FUEL: easement extent hatch fill. 70% transparent.")
  ("BTS-U-FUEL-Label" 7 "Continuous" 18 1 0 "FUEL: text, leaders and callouts.")
  ("BTS-U-FUEL-StandOff" 7 "Continuous" 18 1 0 "FUEL: HSE / PADHI / operator stand-off zone boundary.")
  ("BTS-U-FUEL-StandOff-Hatch" 7 "Continuous" 5 1 70 "FUEL: stand-off zone hatch fill. 70% transparent.")
  ("BTS-U-GAS-Apparatus" 7 "Continuous" 25 1 0 "GAS: service run, plus chambers, poles, pylons, valves, hydrants and cabinets.")
  ("BTS-U-GAS-Easement" 7 "Continuous" 18 1 0 "GAS: legal easement / wayleave extent.")
  ("BTS-U-GAS-Label" 7 "Continuous" 18 1 0 "GAS: text, leaders and callouts.")
  ("BTS-U-GAS-StandOff" 7 "Continuous" 18 1 0 "GAS: HSE / PADHI / operator stand-off zone boundary.")
  ("BTS-U-GAS-StandOff-Hatch" 7 "Continuous" 5 1 70 "GAS: stand-off zone hatch fill. 70% transparent.")
  ("BTS-U-OTHR-Apparatus" 7 "Continuous" 25 1 0 "OTHER: service run, plus chambers, poles, pylons, valves, hydrants and cabinets.")
  ("BTS-U-OTHR-Easement" 7 "Continuous" 18 1 0 "OTHER: legal easement / wayleave extent.")
  ("BTS-U-OTHR-Label" 7 "Continuous" 18 1 0 "OTHER: text, leaders and callouts.")
  ("BTS-U-OTHR-StandOff" 7 "Continuous" 18 1 0 "OTHER: HSE / PADHI / operator stand-off zone boundary.")
  ("BTS-U-OTHR-StandOff-Hatch" 7 "Continuous" 5 1 70 "OTHER: stand-off zone hatch fill. 70% transparent.")
  ("BTS-U-UNKN-Apparatus" 7 "Continuous" 25 1 0 "UNKNOWN: service run, plus chambers, poles, pylons, valves, hydrants and cabinets.")
  ("BTS-U-UNKN-Easement" 7 "Continuous" 18 1 0 "UNKNOWN: legal easement / wayleave extent.")
  ("BTS-U-UNKN-Label" 7 "Continuous" 18 1 0 "UNKNOWN: text, leaders and callouts.")
  ("BTS-U-UNKN-StandOff" 7 "Continuous" 18 1 0 "UNKNOWN: HSE / PADHI / operator stand-off zone boundary.")
  ("BTS-U-UNKN-StandOff-Hatch" 7 "Continuous" 5 1 70 "UNKNOWN: stand-off zone hatch fill. 70% transparent.")
  ("BTS-U-WTR-Apparatus" 7 "Continuous" 25 1 0 "WATER: service run, plus chambers, poles, pylons, valves, hydrants and cabinets.")
  ("BTS-U-WTR-Easement" 7 "Continuous" 18 1 0 "WATER: legal easement / wayleave extent.")
  ("BTS-U-WTR-Easement-Hatch" 7 "Continuous" 5 1 70 "WATER: easement extent hatch fill. 70% transparent.")
  ("BTS-U-WTR-Label" 7 "Continuous" 18 1 0 "WATER: text, leaders and callouts.")
  ("BTS-X-Client" 8 "Continuous" -3 1 0 "Anything client-supplied.")
  ("BTS-X-Flood" 8 "Continuous" -3 1 0 "DEFRA flood zone xref.")
  ("BTS-X-OSMap" 8 "Continuous" -3 1 0 "OS mapping xref.")
  ("BTS-X-Records" 8 "Continuous" -3 1 0 "Statutory undertaker record xrefs and PDF underlays.")
  ("BTS-X-Topo" 8 "Continuous" -3 1 0 "Topographic survey xref.")
))

;;; ---- Legacy layer remapping: (old . new)
(setq *BTS-REMAP* '(
  ;; --- Generation 1: spaced, full-word names (CAD for Dummies era) -------
  ("BTS - Utilities - Electricity"                          . "BTS-U-ELEC-Apparatus")
  ("BTS - Utilities - Gas"                                  . "BTS-U-GAS-Apparatus")
  ("BTS - Utilities - Water"                                . "BTS-U-WTR-Apparatus")
  ("BTS - Utilities - Miscellaneous"                        . "BTS-U-OTHR-Apparatus")
  ("BTS - Utilities - Electricity - Stand-Offs"             . "BTS-U-ELEC-StandOff")
  ("BTS - Utilities - Gas - Stand-Offs"                     . "BTS-U-GAS-StandOff")
  ("BTS - Utilities - Water - Easements"                    . "BTS-U-WTR-Easement")
  ("BTS - Utilities - Miscellaneous - Easements + Stand-Offs" . "BTS-U-OTHR-StandOff")
  ("BTS - Site Boundary"                                    . "BTS-S-Boundary")
  ("BTS - Buildings"                                        . "BTS-S-Buildings")
  ("BTS - Text"                                             . "BTS-A-ANNO-Text")
  ("BTS - Notes - PRINTED"                                  . "BTS-A-ANNO-Notes")
  ("BTS - Notes - NOT PRINTED"                              . "BTS-A-ANNO-TextNonPlot")
  ("BTS - Z - Draft"                                        . "BTS-L-Draft")
  ("BTS - Z - Key"                                          . "BTS-L-Key")
  ("BTS - Z - Page Block"                                   . "BTS-L-PageBlock")
  ("BTS - Z - Non-printed Text"                             . "BTS-A-ANNO-TextNonPlot")
  ("BTS - Z- Non-printed Text"                              . "BTS-A-ANNO-TextNonPlot") ; missing space in source
  ("Dimensions"                                             . "BTS-A-ANNO-DimsLeaders")
  ("Viewport - PRINTED"                                     . "BTS-L-VPort")
  ("Viewport - NOT PRINTED"                                 . "BTS-L-VPortNonPlot")
  ("Viewport - NOT PLOTTED"                                 . "BTS-L-VPortNonPlot")
  ("BTS - Z - Viewport - NOT PRINTED"                       . "BTS-L-VPortNonPlot")

  ;; --- Generation 2: compressed names (Template Rev I era) ---------------
  ("BTS-U-ELEC"           . "BTS-U-ELEC-Apparatus")
  ("BTS-U-GAS"            . "BTS-U-GAS-Apparatus")
  ("BTS-U-WATER"          . "BTS-U-WTR-Apparatus")
  ("BTS-U-MISC"           . "BTS-U-OTHR-Apparatus")
  ("BTS-U-ELEC-StoffEase" . "BTS-U-ELEC-StandOff")
  ("BTS-U-GAS-StoffEase"  . "BTS-U-GAS-StandOff")
  ("BTS-U-WATER-Ease"     . "BTS-U-WTR-Easement")
  ("BTS-U-MISC-Ease"      . "BTS-U-OTHR-Easement")
  ("BTS-A-ANNO-NotesPlot" . "BTS-A-ANNO-Notes")
  ("BTS-A-ANNO-Dims"      . "BTS-A-ANNO-DimsLeaders")
  ("BTS-L-PBLK"           . "BTS-L-PageBlock")
  ("BTS-L-NonPlotVPort"   . "BTS-L-VPortNonPlot")
))

;;; ---- Layers needing a decision by the user. The ayers below are not remapped automatically.
;;;      Wild-card patterns matched with wcmatch.
(setq *BTS-REVIEW* '(
  ("PDF*_*"  . "PDFIMPORT residue - sort onto utility layers, or delete")
  ("PDF_*"   . "PDFIMPORT residue - sort onto utility layers, or delete")
))

;;; ---- Hatch split: (legacy-layer boundary-target hatch-target)
;;;      Legacy layers that hold BOTH the zone boundary and its fill.
;;;      HATCH and SOLID objects go to the -Hatch layer, everything else
;;;      (polylines, lines, arcs, splines) to the boundary layer.
;;;      Entries here take priority over *BTS-REMAP*.
(setq *BTS-SPLIT* '(
  ("BTS - Utilities - Electricity - Stand-Offs"
     "BTS-U-ELEC-StandOff"  "BTS-U-ELEC-StandOff-Hatch")
  ("BTS - Utilities - Gas - Stand-Offs"
     "BTS-U-GAS-StandOff"   "BTS-U-GAS-StandOff-Hatch")
  ("BTS - Utilities - Water - Easements"
     "BTS-U-WTR-Easement"   "BTS-U-WTR-Easement-Hatch")
  ("BTS - Utilities - Miscellaneous - Easements + Stand-Offs"
     "BTS-U-OTHR-StandOff"  "BTS-U-OTHR-StandOff-Hatch")
  ("BTS-U-ELEC-StoffEase"
     "BTS-U-ELEC-StandOff"  "BTS-U-ELEC-StandOff-Hatch")
  ("BTS-U-GAS-StoffEase"
     "BTS-U-GAS-StandOff"   "BTS-U-GAS-StandOff-Hatch")
  ("BTS-U-WATER-Ease"
     "BTS-U-WTR-Easement"   "BTS-U-WTR-Easement-Hatch")
  ("BTS-U-MISC-Ease"
     "BTS-U-OTHR-StandOff"  "BTS-U-OTHR-StandOff-Hatch")
))

;;; ---- Drawing variables: (name value type description)
(setq *BTS-VARS* '(
  ("INSUNITS" 6 "int" "Metres. Model geometry is BNG metres - see audit E.")
  ("LWDISPLAY" 1 "int" "Show lineweights. Replaces the PEDIT width workaround.")
  ("PSLTSCALE" 1 "int" "Paper space linetype scaling.")
  ("MSLTSCALE" 1 "int" "Model space linetype scaling by annotation scale.")
  ("VISRETAIN" 1 "int" "Retain xref layer overrides between sessions.")
  ("XCLIPFRAME" 2 "int" "Display xref clip frame but do not plot it.")
  ("LUPREC" 3 "int" "Linear precision - metres to millimetre.")
  ("AUPREC" 3 "int" "Angular precision - adequate for bearings.")
  ("ATTDIA" 1 "int" "Attribute dialog on INSERT.")
  ("ATTREQ" 1 "int" "Prompt for attribute values.")
  ("FIELDEVAL" 31 "int" "Update fields on open, save, plot, eTransmit, regen.")
  ("CELTYPE" "ByLayer" "str" "Rev I ships ACAD_ISO02W100 - must be ByLayer.")
  ("CECOLOR" "BYLAYER" "str" "Current colour ByLayer.")
  ("CELWEIGHT" -1 "int" "Current lineweight ByLayer.")
  ("CLAYER" "BTS-S-BMap" "str" "Never leave layer 0 current.")
))

;;; ==================================================================
;;;  PART 2 - CORE HELPERS
;;; ==================================================================

(defun bts:lw->str (lw / whole frac)
  (cond
    ((or (null lw) (< lw 0)) "DEFAULT")
    (t (setq whole (fix (/ lw 100)) frac (rem lw 100))
       (strcat (itoa whole) "."
               (if (< frac 10) (strcat "0" (itoa frac)) (itoa frac))))))

;;; Layer transparency is NOT DXF group 440 on the layer table record.
;;; AutoCAD stores it as XDATA under the application "AcCmTransparency",
;;; group code 1071. Group 440 is the entity-level code and is ignored
;;; when written to a LAYER record. Takes a layer NAME, not an entity list.
(defun bts:trans-pct (nm / e xd app v)
  (setq v 0)
  (if (and (setq e (tblobjname "LAYER" nm))
           (setq xd (cdr (assoc -3 (entget e '("AcCmTransparency"))))))
    (foreach app xd
      (if (and (= (car app) "AcCmTransparency")
               (setq app (cdr (assoc 1071 (cdr app)))))
        (setq v (fix (+ 0.5 (/ (* 100.0 (- 255 (logand app 255))) 255.0)))))))
  v)

(defun bts:lay-ent (nm) (tblobjname "LAYER" nm))

;;; Case-insensitive assoc against the remap table. AutoLISP assoc is
;;; case-sensitive; AutoCAD layer names are not.
;;; Case-insensitive lookup in the hatch-split table.
(defun bts:split-of (nm / p hit)
  (foreach p *BTS-SPLIT*
    (if (and (null hit) (= (strcase (car p)) (strcase nm)))
      (setq hit p)))
  hit)

;;; Re-point per-viewport frozen-layer references from OLD to NEW.
;;; DXF 341 on a VIEWPORT holds one entry per VP-frozen layer. A layer
;;; named there counts as REFERENCED, so -PURGE refuses it even when the
;;; layer holds no objects. Deleting the entry would unfreeze the layer in
;;; that viewport and change what plots, so it is re-pointed instead - the
;;; VP freeze carries across to the new layer.
(defun bts:vp-refreeze (old new / oe ne ss i vp el out seen lay n)
  (setq oe (bts:lay-ent old) ne (bts:lay-ent new) n 0)
  (if (and oe ne (setq ss (ssget "_X" '((0 . "VIEWPORT")))))
    (progn
      (setq i 0)
      (repeat (sslength ss)
        (setq vp (ssname ss i) el (entget vp))
        (if (assoc 341 el)
          (progn
            (setq out '() seen '())
            (foreach p el
              (if (/= (car p) 341)
                (setq out (cons p out))
                (progn
                  (if (equal (cdr p) oe) (setq n (1+ n)))
                  (setq lay (if (equal (cdr p) oe) ne (cdr p)))
                  ;; skip a duplicate if the target was already VP-frozen here
                  (if (not (member lay seen))
                    (setq seen (cons lay seen)
                          out  (cons (cons 341 lay) out))))))
            (entmod (reverse out))))
        (setq i (1+ i)))))
  n)

;;; How many objects are still on this layer, model + layouts + block defs?
(defun bts:count-on (lay / ss n bn bent e)
  (setq n 0)
  (if (setq ss (ssget "_X" (list (cons 8 lay)))) (setq n (sslength ss)))
  (setq bn (tblnext "BLOCK" T))
  (while bn
    (if (setq bent (cdr (assoc -2 bn)))
      (while bent
        (setq e (entget bent))
        (if (= (strcase (cdr (assoc 8 e))) (strcase lay)) (setq n (1+ n)))
        (setq bent (entnext bent))))
    (setq bn (tblnext "BLOCK")))
  n)

;;; Move every object on OLD matching FLT onto NEW. Returns the count.
;;; FLT is an ssget filter list; the (8 . old) clause is added here.
(defun bts:move-sel (old new flt / ss i e n)
  (setq n 0)
  (if (setq ss (ssget "_X" (append (list (cons 8 old)) flt)))
    (progn
      (setq i 0)
      (repeat (sslength ss)
        (setq e (entget (ssname ss i)))
        (entmod (subst (cons 8 new) (assoc 8 e) e))
        (setq i (1+ i) n (1+ n)))))
  n)

;;; Objects inside block definitions, optionally restricted by type.
;;; TYPES is a list of DXF type names, or nil for "everything else".
(defun bts:move-blocks (old new types invert / bn bent e n ty)
  (setq n 0 bn (tblnext "BLOCK" T))
  (while bn
    (if (and (zerop (logand (cdr (assoc 70 bn)) 4))      ; not an xref
             (setq bent (cdr (assoc -2 bn))))
      (while bent
        (setq e (entget bent) ty (cdr (assoc 0 e)))
        (if (and (= (strcase (cdr (assoc 8 e))) (strcase old))
                 (if invert (not (member ty types)) (member ty types)))
          (progn (entmod (subst (cons 8 new) (assoc 8 e) e))
                 (setq n (1+ n))))
        (setq bent (entnext bent))))
    (setq bn (tblnext "BLOCK")))
  n)

(defun bts:uniq (l / out x)
  (foreach x l (if (not (member x out)) (setq out (cons x out))))
  (reverse out))

(defun bts:lay-in-std (nm / p hit)
  (foreach p *BTS-LAYERS*
    (if (and (null hit) (= (strcase (car p)) (strcase nm))) (setq hit T)))
  hit)

(defun bts:remap-of (nm / p hit)
  (foreach p *BTS-REMAP*
    (if (and (null hit) (= (strcase (car p)) (strcase nm)))
      (setq hit p)))
  hit)

;;; Does this layer need a human decision rather than a remap?
(defun bts:review-of (nm / p hit)
  (foreach p *BTS-REVIEW*
    (if (and (null hit) (wcmatch (strcase nm) (strcase (car p))))
      (setq hit p)))
  hit)
(defun bts:say (s) (princ (strcat "\n" s)))
(defun bts:pad (s n) (while (< (strlen s) n) (setq s (strcat s " "))) s)

(defun bts:split (s / p q)
  (setq p (vl-string-search "|" s)
        q (vl-string-search "|" s (1+ p)))
  (list (substr s 1 p) (substr s (+ p 2) (- q p 1)) (substr s (+ q 2))))

;;; Set a DXF group code on a layer table record directly.
(defun bts:set-dxf (nm code val / e)
  (if (setq e (tblobjname "LAYER" nm))
    (progn
      (setq e (entget e))
      (entmod (if (assoc code e)
                (subst (cons code val) (assoc code e) e)
                (append e (list (cons code val))))))))

;;; Encode a transparency percentage: 0x02000000 + alpha, alpha 255 = opaque.
;;; Same encoding whether stored as entity code 440 or layer xdata 1071.
(defun bts:trans-code (pct)
  (+ 33554432 (fix (+ 0.5 (- 255.0 (* 2.55 pct))))))

;;; Create a layer table record without going near (command).
(defun bts:mk-layer (nm col lt lw pl)
  (entmake (list '(0 . "LAYER")
                 '(100 . "AcDbSymbolTableRecord")
                 '(100 . "AcDbLayerTableRecord")
                 (cons 2 nm)
                 '(70 . 0)
                 (cons 62 col)
                 (cons 6 (if (= lt "ByLayer") "Continuous" lt))
                 (cons 370 lw)
                 (cons 290 pl))))

;;; Description and transparency are BOTH xdata on the layer record, under
;;; different application names. entmod rewrites the whole -3 group, so they
;;; must be written together or one wipes the other.
(defun bts:set-lay-xdata (nm txt pct / e xd)
  (if (setq e (tblobjname "LAYER" nm))
    (progn
      (regapp "AcAecLayerStandard")
      (regapp "AcCmTransparency")
      (setq e  (entget e '("AcAecLayerStandard" "AcCmTransparency"))
            xd (list -3
                     (list "AcAecLayerStandard"
                           (cons 1000 "") (cons 1000 txt))
                     (list "AcCmTransparency"
                           (cons 1071 (bts:trans-code pct)))))
      (entmod (if (assoc -3 e)
                (subst xd (assoc -3 e) e)
                (append e (list xd)))))))

;;; ==================================================================
;;;  PART 3 - THE AUDIT AND THE REGISTER COMMANDS
;;;  Release R v1.1, unchanged: BTSCHECK, BTSFIX, BTSREMAP, BTSVARS,
;;;  BTSJUNK, BTSOVERRIDE and BTSREPORT.
;;; ==================================================================

(defun bts:audit (/ res spec nm col lt lw pl tr e ecol elt elw epl etr known n)
  (setq res '() known '())
  (foreach spec *BTS-LAYERS*
    (setq nm  (nth 0 spec) col (nth 1 spec) lt (nth 2 spec)
          lw  (nth 3 spec) pl  (nth 4 spec) tr (nth 5 spec)
          known (cons (strcase nm) known))
    (if (null (setq e (bts:lay-ent nm)))
      (setq res (cons (strcat "MISSING  |" nm "|layer not present") res))
      (progn
        (setq e    (entget e)
              ecol (abs (cond ((cdr (assoc 62 e))) (t 7)))
              elt  (cond ((cdr (assoc 6 e))) (t "Continuous"))
              elw  (cond ((assoc 370 e) (cdr (assoc 370 e))) (t -3))
              epl  (cond ((assoc 290 e) (cdr (assoc 290 e))) (t 1))
              etr  (bts:trans-pct nm))
        (if (not (= ecol col))
          (setq res (cons (strcat "COLOUR   |" nm "|is " (itoa ecol)
                                  ", should be " (itoa col)) res)))
        (if (and (not (= lt "ByLayer"))
                 (not (= (strcase elt) (strcase lt))))
          (setq res (cons (strcat "LINETYPE |" nm "|is " elt
                                  ", should be " lt) res)))
        (if (not (= elw lw))
          (setq res (cons (strcat "LWEIGHT  |" nm "|is " (bts:lw->str elw)
                                  ", should be " (bts:lw->str lw)) res)))
        (if (not (= epl pl))
          (setq res (cons (strcat "PLOT     |" nm "|is "
                                  (if (= epl 1) "Yes" "No") ", should be "
                                  (if (= pl 1) "Yes" "No")) res)))
        (if (> (abs (- etr tr)) 2)
          (setq res (cons (strcat "TRANSP   |" nm "|is " (itoa etr)
                                  "%, should be " (itoa tr) "%") res))))))
  (setq n (tblnext "LAYER" T))
  (while n
    (setq nm (cdr (assoc 2 n)))
    (if (and (not (member (strcase nm) known))
             (not (= (strcase nm) "0"))
             (not (= (strcase nm) "DEFPOINTS"))
             (not (wcmatch nm "*|*")))
      (setq res (cons
        (cond
          ((bts:remap-of nm)
           (strcat "LEGACY   |" nm "|remap to " (cdr (bts:remap-of nm))))
          ((bts:review-of nm)
           (strcat "REVIEW   |" nm "|" (cdr (bts:review-of nm))))
          (t (strcat "NONSTD   |" nm "|not in the BTS standard")))
        res)))
    (setq n (tblnext "LAYER")))
  (reverse res))

;;; ------------------------------------------------------------------
;;;  BTSCHECK
;;; ------------------------------------------------------------------

(defun C:BTSCHECK (/ iss parts)
  (setq iss (bts:audit))
  (bts:say (strcat "BTS " *BTS-STD-VERSION* " - audit of " (getvar "DWGNAME")))
  (bts:say "--------------------------------------------------------------")
  (if (null iss)
    (bts:say "  No deviations found.")
    (foreach i iss
      (setq parts (bts:split i))
      (bts:say (strcat "  " (bts:pad (nth 0 parts) 10)
                       (bts:pad (nth 1 parts) 32)
                       (nth 2 parts)))))
  (bts:say "--------------------------------------------------------------")
  (bts:say (strcat "  " (itoa (length iss)) " deviation(s)."))
  (bts:say "  BTSFIX corrects properties.  BTSREMAP clears legacy layers.")
  (princ))

;;; ------------------------------------------------------------------
;;;  BTSFIX
;;; ------------------------------------------------------------------

(defun C:BTSFIX (/ *error* spec nm col lt lw pl tr made fixed)

  ;; No (command) calls in this function, so the error handler must not
  ;; make one either - see *push-error-using-command* in the AutoLISP docs.
  (defun *error* (m)
    (princ (strcat "\nBTSFIX stopped while processing layer: "
                   (if nm nm "(none)") "\n  " m))
    (princ))

  (setq made 0 fixed 0)
  (bts:say "Applying BTS Layer Standard Rev E ...")
  (foreach spec *BTS-LAYERS*
    (setq nm (nth 0 spec) col (nth 1 spec) lt (nth 2 spec)
          lw (nth 3 spec) pl (nth 4 spec) tr (nth 5 spec))
    (if (null (bts:lay-ent nm))
      (progn (bts:mk-layer nm col lt lw pl) (setq made (1+ made)))
      (progn
        (bts:set-dxf nm 62  col)
        (bts:set-dxf nm 6   (if (= lt "ByLayer") "Continuous" lt))
        (bts:set-dxf nm 370 lw)
        (bts:set-dxf nm 290 pl)
        (setq fixed (1+ fixed))))
    (bts:set-lay-xdata nm (nth 6 spec) tr)
    (princ "."))
  (setq nm nil)
  (bts:say (strcat "Done. " (itoa made) " layer(s) created, "
                   (itoa fixed) " updated."))
  (bts:say "Run BTSCHECK to confirm, then BTSREMAP for the LEGACY entries.")
  (princ))

;;; ------------------------------------------------------------------
;;;  BTSREMAP
;;;  Scripted equivalent of LAYMRG. LAYMRG's Name option opens a dialog,
;;;  so it cannot be automated; this walks the database instead.
;;;  Covers model space, all layouts, and block definitions.
;;; ------------------------------------------------------------------

(defun C:BTSREMAP (/ *error* ce pair old new hlay work nh nb nsplit nleft nvp
                     ss i e bn bent moved gone rec nm left nrev)

  ;; BTSREMAP does call -PURGE and REGENALL, so the error handler is
  ;; permitted to cancel them - but only after *push-error-using-command*.
  (defun *error* (m)
    (if *pop-error-mode* (*pop-error-mode*))
    (if ce (setvar "CMDECHO" ce))
    (princ (strcat "\nBTSREMAP stopped on layer: "
                   (if old old "(none)") "\n  " m))
    (princ))

  (setq ce (getvar "CMDECHO") moved 0 gone 0 nsplit 0)
  (setvar "CMDECHO" 0)
  (bts:say "Remapping legacy layers ...")

  ;; Build the work list: splits first, then plain remaps not already split.
  (setq work '())
  (foreach pair *BTS-SPLIT*
    (setq work (cons (list (car pair) (cadr pair) (caddr pair)) work)))
  (foreach pair *BTS-REMAP*
    (if (null (bts:split-of (car pair)))
      (setq work (cons (list (car pair) (cdr pair) nil) work))))
  (setq work (reverse work))

  (foreach pair work
    (setq old (car pair) new (cadr pair) hlay (caddr pair))
    (if (bts:lay-ent old)
      (cond
        ((null (bts:lay-ent new))
         (bts:say (strcat "  SKIPPED " old " - target " new
                          " missing. Run BTSFIX first.")))
        ((and hlay (null (bts:lay-ent hlay)))
         (bts:say (strcat "  SKIPPED " old " - hatch target " hlay
                          " missing. Run BTSFIX first.")))
        (t
         ;; thaw, turn on and unlock via DXF rather than -LAYER keywords
         (bts:set-dxf old 70 (logand (cdr (assoc 70 (entget (bts:lay-ent old))))
                                     (~ 5)))
         (bts:set-dxf old 62 (abs (cdr (assoc 62 (entget (bts:lay-ent old))))))

         (if hlay
           ;; --- split: fills to the -Hatch layer, boundaries to the other
           (progn
             (setq nh (+ (bts:move-sel old hlay
                           '((-4 . "<OR") (0 . "HATCH") (0 . "SOLID") (-4 . "OR>")))
                         (bts:move-blocks old hlay '("HATCH" "SOLID") nil))
                   nb (+ (bts:move-sel old new
                           '((-4 . "<NOT")
                             (-4 . "<OR") (0 . "HATCH") (0 . "SOLID") (-4 . "OR>")
                             (-4 . "NOT>")))
                         (bts:move-blocks old new '("HATCH" "SOLID") T))
                   moved (+ moved nh nb))
             (if (> nh 0) (setq nsplit (1+ nsplit)))
             (bts:say (strcat "  " old
                              "\n      -> " new "   (" (itoa nb) " boundary)"
                              "\n      -> " hlay "   (" (itoa nh) " fill)")))
           ;; --- plain remap: everything to one layer
           (progn
             (setq nb (+ (bts:move-sel old new '())
                         (bts:move-blocks old new '() T))
                   moved (+ moved nb))
             (bts:say (strcat "  " old " -> " new
                              "   (" (itoa nb) " object"
                              (if (= nb 1) ")" "s)")))))

         (if (= (strcase (getvar "CLAYER")) (strcase old))
           (setvar "CLAYER" new))

         ;; Carry any per-viewport freeze across before purging.
         (setq nvp (bts:vp-refreeze old new))
         (if (> nvp 0)
           (bts:say (strcat "      " (itoa nvp)
                            " viewport freeze reference(s) moved to " new)))

         ;; Only call -PURGE once the layer is genuinely empty, so its
         ;; "No unreferenced layers found" message cannot mislead.
         (setq nleft (bts:count-on old))
         (if (> nleft 0)
           (bts:say (strcat "      NOT PURGED - " (itoa nleft)
                            " object(s) could not be moved."
                            "\n      Likely inside an xref, or a block this"
                            " routine cannot edit."))
           (progn
             (if *push-error-using-command* (*push-error-using-command*))
             (command "_.-PURGE" "_LA" old "_N")
             (if *pop-error-mode* (*pop-error-mode*))
             (if (bts:lay-ent old)
               (bts:say (strcat "      NOT PURGED - layer is empty but still"
                                " referenced.\n      Check for a saved layer state"
                                " (LAYERSTATE), a layer filter,\n      or a viewport"
                                " property override, then PURGE by hand."))
               (setq gone (1+ gone)))))))))
  (if *push-error-using-command* (*push-error-using-command*))
  (command "_.REGENALL")
  (if *pop-error-mode* (*pop-error-mode*))
  (setvar "CMDECHO" ce)
  (bts:say (strcat "Done. " (itoa moved) " object(s) moved, "
                   (itoa gone) " legacy layer(s) purged."))
  (if (> nsplit 0)
    (progn
      (bts:say (strcat "  " (itoa nsplit)
                       " layer(s) were split into boundary and fill."))
      (bts:say "  Check for BYOBJECT colour or transparency on the moved")
      (bts:say "  hatches - QSELECT, or run BTSOVERRIDE.")))

  ;; Never finish silently: say what was left behind and why.
  (setq rec (tblnext "LAYER" T) left '() nrev 0)
  (while rec
    (setq nm (cdr (assoc 2 rec)))
    (if (and (not (= (strcase nm) "0"))
             (not (= (strcase nm) "DEFPOINTS"))
             (not (wcmatch nm "*|*"))
             (null (bts:remap-of nm))
             (null (bts:lay-in-std nm)))
      (if (bts:review-of nm)
        (setq nrev (1+ nrev))
        (setq left (cons nm left))))
    (setq rec (tblnext "LAYER")))
  (if (> nrev 0)
    (bts:say (strcat "  " (itoa nrev)
                     " layer(s) need a manual decision - run BTSCHECK and see REVIEW.")))
  (if left
    (progn
      (bts:say (strcat "  " (itoa (length left))
                       " layer(s) are not in the standard and have no remap:"))
      (foreach nm (reverse left) (bts:say (strcat "     " nm)))
      (bts:say "  Add them to *BTS-REMAP*, or move the objects by hand.")))
  (princ))

;;; ------------------------------------------------------------------
;;;  BTSVARS
;;; ------------------------------------------------------------------

(defun C:BTSVARS (/ v nm want typ cur bad ans)
  (setq bad '())
  (foreach v *BTS-VARS*
    (setq nm (nth 0 v) want (nth 1 v) typ (nth 2 v)
          cur (vl-catch-all-apply 'getvar (list nm)))
    (if (not (vl-catch-all-error-p cur))
      (if (if (= typ "str")
            (not (= (strcase (vl-princ-to-string cur)) (strcase want)))
            (not (= cur want)))
        (setq bad (cons (list nm cur want (nth 3 v)) bad)))))
  (setq bad (reverse bad))
  (if (null bad)
    (bts:say "All drawing variables conform.")
    (progn
      (bts:say "Non-conforming drawing variables:")
      (foreach v bad
        (bts:say (strcat "  " (bts:pad (nth 0 v) 13)
                         "is "        (bts:pad (vl-princ-to-string (nth 1 v)) 15)
                         "should be " (bts:pad (vl-princ-to-string (nth 2 v)) 15)
                         (nth 3 v))))
      (initget "Yes No")
      (setq ans (getkword "\nSet these now? [Yes/No] <No>: "))
      (if (= ans "Yes")
        (progn
          (foreach v bad
            (vl-catch-all-apply 'setvar (list (nth 0 v) (nth 2 v))))
          (bts:say "Variables set. Re-run BTSVARS to confirm.")))))
  (princ))

;;; ------------------------------------------------------------------
;;;  BTSJUNK
;;; ------------------------------------------------------------------

(defun C:BTSJUNK (/ n hits)
  (setq hits 0)
  (bts:say "Housekeeping scan")
  (bts:say "--------------------------------------------------------------")
  (setq n (tblnext "LAYER" T))
  (while n
    (if (wcmatch (cdr (assoc 2 n)) "*`@*")
      (progn (bts:say (strcat "  BOUND-XREF LAYER    " (cdr (assoc 2 n))))
             (setq hits (1+ hits))))
    (setq n (tblnext "LAYER")))
  (setq n (tblnext "BLOCK" T))
  (while n
    (cond
      ((wcmatch (cdr (assoc 2 n)) "A$C*")
       (bts:say (strcat "  BOUND-XREF BLOCK    " (cdr (assoc 2 n))))
       (setq hits (1+ hits)))
      ((wcmatch (cdr (assoc 2 n)) "TB `- *")
       (bts:say (strcat "  LEGACY TITLE BLOCK  " (cdr (assoc 2 n))))
       (setq hits (1+ hits))))
    (setq n (tblnext "BLOCK")))
  (setq n (tblnext "STYLE" T))
  (while n
    (if (wcmatch (strcase (cdr (assoc 2 n))) "PDF *")
      (progn (bts:say (strcat "  PDF-IMPORT STYLE    " (cdr (assoc 2 n))))
             (setq hits (1+ hits))))
    (setq n (tblnext "STYLE")))
  (bts:say "--------------------------------------------------------------")
  (bts:say (strcat "  " (itoa hits)
                   " item(s). Review before PURGE - some may be in use."))
  (princ))

;;; ------------------------------------------------------------------
;;;  BTSREPORT
;;; ------------------------------------------------------------------

(defun C:BTSREPORT (/ fn f iss p d)
  (setq p (getvar "DWGPREFIX"))
  (if (= p "") (setq p (getvar "TEMPPREFIX")))
  (setq fn (strcat p (vl-filename-base (getvar "DWGNAME")) "_BTSCheck.txt")
        d  (rtos (getvar "CDATE") 2 6))
  (if (setq f (open fn "w"))
    (progn
      (write-line (strcat "BTS " *BTS-STD-VERSION* " - standards report") f)
      (write-line (strcat "Drawing  : " (getvar "DWGNAME")) f)
      (write-line (strcat "Folder   : " (getvar "DWGPREFIX")) f)
      (write-line (strcat "CDATE    : " d "  (YYYYMMDD.HHMMSS)") f)
      (write-line "" f)
      (setq iss (bts:audit))
      (if (null iss)
        (write-line "No deviations found." f)
        (foreach i iss (write-line (strcat "  " i) f)))
      (write-line "" f)
      (write-line (strcat (itoa (length iss)) " deviation(s).") f)
      (close f)
      (bts:say (strcat "Report written: " fn)))
    (bts:say "Could not write report - check folder permissions."))
  (princ))

;;; ------------------------------------------------------------------
;;;  BTSOVERRIDE  -  find objects whose appearance is set BYOBJECT
;;;  Section 2 rule 2 of the standard: colour, lineweight and plot state
;;;  are ByLayer, always. BTSCHECK audits the LAYER table and cannot see
;;;  per-object overrides, so this covers the gap - particularly after a
;;;  split, where hatches may carry their own transparency.
;;; ------------------------------------------------------------------

(defun C:BTSOVERRIDE (/ ss i e nc nlt nlw ntr tot lay bad)
  (setq nc 0 nlt 0 nlw 0 ntr 0 tot 0 bad '())
  (if (setq ss (ssget "_X"))
    (progn
      (setq i 0)
      (repeat (sslength ss)
        (setq e   (entget (ssname ss i))
              lay (cdr (assoc 8 e)))
        ;; 62 present and not 256 = colour set by object
        ;; 6  present and not "ByLayer" = linetype set by object
        ;; 370 present and not -1 = lineweight set by object
        ;; 440 present = transparency set by object
        (if (and (assoc 62 e) (/= (abs (cdr (assoc 62 e))) 256))
          (setq nc (1+ nc) bad (cons lay bad)))
        (if (and (assoc 6 e)
                 (not (member (strcase (cdr (assoc 6 e))) '("BYLAYER" "BYBLOCK"))))
          (setq nlt (1+ nlt) bad (cons lay bad)))
        (if (and (assoc 370 e) (>= (cdr (assoc 370 e)) 0))
          (setq nlw (1+ nlw) bad (cons lay bad)))
        (if (assoc 440 e)
          (setq ntr (1+ ntr) bad (cons lay bad)))
        (setq i (1+ i) tot (1+ tot)))))
  (bts:say (strcat "BYOBJECT override scan - " (itoa tot) " object(s) examined"))
  (bts:say "--------------------------------------------------------------")
  (bts:say (strcat "  colour        " (itoa nc)))
  (bts:say (strcat "  linetype      " (itoa nlt)
                   "   (expected: utility runs - see standard section 3)"))
  (bts:say (strcat "  lineweight    " (itoa nlw)))
  (bts:say (strcat "  transparency  " (itoa ntr)))
  (bts:say "--------------------------------------------------------------")
  (if (or (> nc 0) (> nlw 0) (> ntr 0))
    (progn
      (bts:say "  Layers affected:")
      (foreach lay (bts:uniq bad) (bts:say (strcat "     " lay)))
      (bts:say "")
      (bts:say "  To clear: QSELECT the objects, then set Colour, Lineweight")
      (bts:say "  and Transparency to ByLayer in Properties. Leave LINETYPE")
      (bts:say "  alone on utility runs - that override is the standard."))
    (bts:say "  No colour, lineweight or transparency overrides found."))
  (princ))


;;; ==================================================================
;;;  PART 4 - APPROVER SUITE
;;; ==================================================================

;;; ------------------------------------------------------------------
;;;  Configuration. Everything below is site policy rather than
;;;  drawing data - edit these tables, not the code.
;;; ------------------------------------------------------------------

;;; Plot scale denominators accepted in a viewport, read as 1:N with the
;;; model in metres and the sheet in millimetres (INSUNITS 6, the BTS
;;; default). Anything else is reported, not corrected.
(setq *BTS-A-SCALES*
  '(1 2 5 10 20 25 50 100 200 250 500 1000 1250 2500 5000 10000))
(setq *BTS-A-SCALE-TOL* 0.02)          ; 2% before a scale is called odd

;;; British National Grid envelope, metres. Anything outside this is not
;;; on the grid, whatever the drawing claims.
(setq *BTS-A-BNG-E* '(0.0 700000.0))
(setq *BTS-A-BNG-N* '(0.0 1300000.0))
(setq *BTS-A-SITE-MAX* 20000.0)        ; a site wider than 20 km is suspect
(setq *BTS-A-ORIGIN-TOL* 1000.0)       ; geometry this close to 0,0 is floating

;;; Grid spacings a BTS sheet is allowed to use, metres.
(setq *BTS-A-GRID-STEPS* '(10.0 25.0 50.0 100.0 250.0 500.0 1000.0 5000.0 10000.0))
(setq *BTS-A-GRID-TOL* 0.05)           ; label vs line agreement, metres

;;; PAS 128 quality levels. Suffixed variants (QL-B1P and friends) are
;;; matched by the wildcards, so add only whole new levels here.
(setq *BTS-A-QL* '("QL-A" "QL-B1" "QL-B2" "QL-B3" "QL-B4" "QL-C" "QL-D"))
(setq *BTS-A-QL-WC* '("QL-A" "QL-B1*" "QL-B2*" "QL-B3*" "QL-B4*" "QL-B" "QL-C*" "QL-D*"))
(setq *BTS-A-QL-LAYER* "BTS-A-ANNO-QL")

;;; Utility clash detection. Segment count above the cap asks first -
;;; the test is O(n squared) on segment pairs.
(setq *BTS-A-CLEARANCE* 0.5)           ; metres, proximity warning
(setq *BTS-A-CLASH-MAX* 4000)          ; segments before asking to continue
(setq *BTS-A-CLASH-LIST* 25)           ; coordinates listed per service pair

;;; Title block detection and the metadata an approver signs off.
;;; Rows are (tag-wildcard mandatory description). Tags are matched with
;;; wcmatch, so "DWG*NO*" catches DWGNO, DWG_NUMBER and DRAWING NUMBER.
(setq *BTS-A-TITLEBLOCKS* '("BTS*" "TB*" "*TITLE*BLOCK*" "*TITLEBLOCK*" "*PAGE*BLOCK*"))
(setq *BTS-A-TITLE-ATTS* '(
  ("*DWG*NO*"     T   "Drawing number")
  ("*DRAWING*NO*" nil "Drawing number (alternative tag)")
  ("REV*"         T   "Revision code")
  ("*TITLE*"      T   "Sheet title")
  ("CLIENT*"      T   "Client")
  ("PROJECT*"     T   "Project")
  ("*SCALE*"      T   "Plot scale")
  ("*DATE*"       T   "Issue date")
  ("*DRAWN*"      T   "Drawn by")
  ("*CHECK*"      T   "Checked by")
  ("*APPROV*"     T   "Approved by")
  ("*STATUS*"     nil "Suitability / status code")
  ("*SUITAB*"     nil "Suitability code")
))

;;; Placeholder values that pass a "not blank" test but are not metadata.
(setq *BTS-A-PLACEHOLDERS* '("XX*" "X" "?" "??" "???" "TBC*" "TBA*" "N/A" "NA"
                             "-" "--" "..." "DRAFT" "INSERT*" "ENTER*" "TEXT"))

;;; ISO 19650 / BS 1192 suitability codes, checked when a STATUS or
;;; SUITABILITY attribute exists.
(setq *BTS-A-STATUS-CODES*
  '("S0" "S1" "S2" "S3" "S4" "S5" "S6" "S7"
    "A1" "A2" "A3" "A4" "A5" "AB" "B1" "B2" "B3" "B4" "B5"
    "CR" "D1" "D2" "D3" "D4"))

;;; Units the BTS standard assumes. (variable value description)
(setq *BTS-A-UNITS* '(
  ("INSUNITS"    6 "Metres. Blocks and xrefs scale from this.")
  ("MEASUREMENT" 1 "Metric - drives the hatch and linetype file.")
  ("LUNITS"      2 "Decimal linear units.")
  ("LUPREC"      3 "Metres shown to the millimetre.")
  ("AUNITS"      0 "Decimal degrees.")
  ("AUPREC"      3 "Angular precision for bearings.")
))

;;; Sheet text heights in millimetres, applied to paper space and
;;; annotative text only - model space heights follow the plot scale
;;; and are reported as a census instead.
(setq *BTS-A-TEXT-HEIGHTS* '(1.8 2.5 3.5 5.0 7.0))
(setq *BTS-A-TEXT-TOL* 0.01)

;;; Site specific name tables. Empty means "census only, no name rule".
;;; Fill them in and the matching check turns into a pass/fail.
;;;   *BTS-A-TEXT-STYLES*   ("name" "font-file" width oblique)
;;;   *BTS-A-DIM-STYLES*    ("name")
;;;   *BTS-A-MLEAD-STYLES*  ("name")
;;;   *BTS-A-BLOCK-NAMES*   wildcards an approved block name may match
;;;   *BTS-A-UTIL-LTYPE*    ("layer-wildcard" "ltype-wildcard" ...)
(setq *BTS-A-TEXT-STYLES* '())
(setq *BTS-A-DIM-STYLES* '())
(setq *BTS-A-MLEAD-STYLES* '())
(setq *BTS-A-BLOCK-NAMES* '())
(setq *BTS-A-UTIL-LTYPE* '())

;;; Block names that must survive a purge whatever their reference count.
(setq *BTS-A-KEEP-BLOCKS*
  '("BTS*" "TB*" "*TITLE*" "*NORTH*" "*SCALE*BAR*" "*LOGO*" "*KEY*" "*LEGEND*"))
(setq *BTS-A-KEEP-STYLES* '("BTS*" "STANDARD" "ANNOTATIVE"))

;;; Junk block and style patterns, extending release R's BTSJUNK list.
(setq *BTS-A-JUNK-BLOCKS* '("A`$C*" "*`|*" "*`$0`$*" "TB `- *"))

;;; Layers that must be frozen in every viewport before a drawing is
;;; issued. BTSVPFREEZE Standard applies this list.
(setq *BTS-A-VPFREEZE* '("BTS-L-Draft"))

;;; Layout names that mean nobody has set the sheet up yet.
(setq *BTS-A-DEFAULT-LAYOUTS* '("LAYOUT1" "LAYOUT2" "LAYOUT3"))

;;; Batch. Set by the generated script so the auto commands stop asking.
(setq *BTS-A-BATCH* nil)
(setq *BTS-A-LOGNAME* "BTS-Project-Log.csv")

;;; ------------------------------------------------------------------
;;;  Generic helpers
;;; ------------------------------------------------------------------

;;; Every check returns a list of "CODE     |item|detail" strings, the
;;; same shape release R's bts:audit uses, so one printer, one report
;;; writer and one CSV column set cover the whole suite. Only the item
;;; has to be pipe free - bts:split takes everything after the second
;;; pipe as the detail.
(defun bts:iss (code item detail)
  (strcat (bts:pad code 9) "|" (bts:str-rep item "|" "/") "|" detail))

(defun bts:iss-code (s) (bts:trim (nth 0 (bts:split s))))
(defun bts:iss-item (s) (nth 1 (bts:split s)))
(defun bts:iss-detail (s) (nth 2 (bts:split s)))

(defun bts:iss-line (s / p)
  (setq p (bts:split s))
  (strcat "  " (bts:pad (nth 0 p) 10) (bts:pad (nth 1 p) 32) (nth 2 p)))

(defun bts:str-rep (s old new / p out)
  (setq out "")
  (while (setq p (vl-string-search old s))
    (setq out (strcat out (substr s 1 p) new)
          s   (substr s (+ p (strlen old) 1))))
  (strcat out s))

(defun bts:trim (s)
  (vl-string-trim " \t\r\n" s))

(defun bts:assoc-ci (k lst / p hit)
  (foreach p lst
    (if (and (null hit) (= (type (car p)) 'STR) (= (strcase (car p)) (strcase k)))
      (setq hit p)))
  hit)

(defun bts:member-ci (s lst / x hit)
  (foreach x lst
    (if (and (null hit) (= (strcase x) (strcase s))) (setq hit T)))
  hit)

(defun bts:wc-any (s pats / p hit)
  (foreach p pats
    (if (and (null hit) (wcmatch (strcase s) (strcase p))) (setq hit T)))
  hit)

;;; Running counts, keyed by string. Returns the new alist.
(defun bts:tally (key lst / hit)
  (if (setq hit (bts:assoc-ci key lst))
    (subst (cons (car hit) (1+ (cdr hit))) hit lst)
    (cons (cons key 1) lst)))

(defun bts:tally-n (key n lst / hit)
  (if (setq hit (bts:assoc-ci key lst))
    (subst (cons (car hit) (+ n (cdr hit))) hit lst)
    (cons (cons key n) lst)))

;;; Insertion sort. FN is a less-than predicate taking two elements.
(defun bts:sort (lst fn / out x y head)
  (setq out '())
  (foreach x lst
    (setq head '())
    (while (and out (apply fn (list (car out) x)))
      (setq head (cons (car out) head)
            out  (cdr out)))
    (setq out (cons x out))
    (foreach y head (setq out (cons y out))))
  out)

(defun bts:sort-alpha (lst)
  (bts:sort lst '(lambda (a b) (< (strcase a) (strcase b)))))

;;; Descending by count, for census output.
(defun bts:sort-count (lst)
  (bts:sort lst '(lambda (a b) (> (cdr a) (cdr b)))))

(defun bts:near (a b tol) (< (abs (- a b)) tol))

(defun bts:rnd (x dp / m)
  (setq m (expt 10.0 dp))
  (/ (fix (+ (* x m) (if (minusp x) -0.5 0.5))) m))

;;; First numeric run in a string, as a real. "E 452 300" gives 452.0,
;;; which is why grid labels are stripped of spaces before they get here.
(defun bts:num-in-str (s / i c out seen stop)
  (setq i 1 out "" seen nil stop nil)
  (while (and (<= i (strlen s)) (null stop))
    (setq c (substr s i 1))
    (cond
      ((wcmatch c "#") (setq out (strcat out c) seen T))
      ((and (= c ".") seen) (setq out (strcat out c)))
      ((and (= c "-") (not seen) (= out "")) (setq out "-"))
      (seen (setq stop T))
      (t (setq out "")))
    (setq i (1+ i)))
  (if seen (atof out)))

(defun bts:no-space (s)
  (bts:str-rep (bts:str-rep s " " "") "," ""))

;;; ---- files ----

(defun bts:dwg-dir ( / p)
  (setq p (getvar "DWGPREFIX"))
  (if (or (null p) (= p "")) (setq p (getvar "TEMPPREFIX")))
  p)

(defun bts:out-file (suffix ext)
  (strcat (bts:dwg-dir) (vl-filename-base (getvar "DWGNAME")) suffix ext))

(defun bts:end-slash (d)
  (if (and d (/= d "") (not (member (substr d (strlen d) 1) '("\\" "/"))))
    (strcat d "\\")
    d))

;;; CDATE is YYYYMMDD.HHMMSS - readable, and sorts correctly as text.
(defun bts:stamp ( / d)
  (setq d (rtos (getvar "CDATE") 2 6))
  (strcat (substr d 1 4) "-" (substr d 5 2) "-" (substr d 7 2) " "
          (substr d 10 2) ":" (substr d 12 2) ":" (substr d 14 2)))

(defun bts:datestamp ( / d)
  (setq d (rtos (getvar "CDATE") 2 6))
  (strcat (substr d 1 4) (substr d 5 2) (substr d 7 2)))

;;; TDCREATE and TDUPDATE are Julian. DIESEL knows how to format them
;;; and LT carries DIESEL, so borrow it rather than writing a calendar.
(defun bts:jdate (var / r)
  (setq r (vl-catch-all-apply 'menucmd
            (list (strcat "M=$(edtime,$(getvar," var "),YYYY-MO-DD HH:MM)"))))
  (if (or (vl-catch-all-error-p r) (null r) (= r ""))
    (rtos (getvar var) 2 6)
    r))

(defun bts:open-out (fn / f)
  (if (setq f (open fn "w"))
    f
    (progn (bts:say (strcat "Could not write " fn " - check folder permissions.")) nil)))

;;; ---- CSV ----

(defun bts:csv-cell (v / s)
  (setq s (cond ((null v) "")
                ((= (type v) 'STR) v)
                ((= (type v) 'INT) (itoa v))
                ((= (type v) 'REAL) (rtos v 2 4))
                (t (vl-princ-to-string v))))
  (strcat "\"" (bts:str-rep s "\"" "\"\"") "\""))

(defun bts:csv-row (lst / out sep x)
  (setq out "" sep "")
  (foreach x lst (setq out (strcat out sep (bts:csv-cell x)) sep ","))
  out)

(defun bts:csv-split (s / i c n out cur q)
  (setq i 1 n (strlen s) out '() cur "" q nil)
  (while (<= i n)
    (setq c (substr s i 1))
    (cond
      (q (cond ((and (= c "\"") (= (substr s (1+ i) 1) "\""))
                (setq cur (strcat cur "\"") i (1+ i)))
               ((= c "\"") (setq q nil))
               (t (setq cur (strcat cur c)))))
      ((= c "\"") (setq q T))
      ((= c ",") (setq out (cons cur out) cur ""))
      (t (setq cur (strcat cur c))))
    (setq i (1+ i)))
  (reverse (cons cur out)))

(defun bts:csv-read (fn / f l out)
  (if (setq f (open fn "r"))
    (progn
      (while (setq l (read-line f))
        (if (/= (bts:trim l) "") (setq out (cons (bts:csv-split l) out))))
      (close f)))
  (reverse out))

(defun bts:fld (row n)
  (if (< n (length row)) (nth n row) ""))

;;; ---- printing ----

(defun bts:rule ()
  (bts:say "--------------------------------------------------------------"))

(defun bts:head (title)
  (bts:say (strcat "BTS " *BTS-A-VERSION* " - " title))
  (bts:say (strcat "  " (getvar "DWGNAME") "   " (bts:stamp)))
  (bts:rule))

;;; One printer for every check in the suite. Returns the issue count so
;;; the auto and batch commands can add them up.
(defun bts:show (title iss / i)
  (bts:head title)
  (if (null iss)
    (bts:say "  Nothing to report.")
    (foreach i iss (bts:say (bts:iss-line i))))
  (bts:rule)
  (bts:say (strcat "  " (itoa (length iss)) " item(s)."))
  (length iss))

(defun bts:show-census (title lst unit / p)
  (bts:say (strcat "  " title))
  (if (null lst)
    (bts:say "     (none)")
    (foreach p (bts:sort-count lst)
      (bts:say (strcat "     " (bts:pad (car p) 40) (itoa (cdr p)) " " unit)))))

(defun bts:ask (q dflt)
  (if *BTS-A-BATCH*
    dflt
    (progn (initget "Yes No")
           (cond ((getkword (strcat "\n" q " [Yes/No] <" dflt ">: ")))
                 (t dflt)))))

;;; ------------------------------------------------------------------
;;;  Layer API
;;;
;;;  bts:lay-ent, bts:vp-refreeze, bts:count-on, bts:move-sel,
;;;  bts:move-blocks and bts:audit are in part 2 and part 3 above. The
;;;  wrappers here give them their suite names without a second
;;;  implementation.
;;; ------------------------------------------------------------------

(defun bts:count-on-layer (lay) (bts:count-on lay))
(defun bts:move-selection (old new flt) (bts:move-sel old new flt))
(defun bts:move-block-contents (old new types invert)
  (bts:move-blocks old new types invert))

;;; The register row for a layer, or nil if it is not in the standard.
(defun bts:layer-spec (nm / p hit)
  (foreach p *BTS-LAYERS*
    (if (and (null hit) (= (strcase (car p)) (strcase nm))) (setq hit p)))
  hit)

(defun bts:lay-in-standard (nm) (if (bts:layer-spec nm) T))

(defun bts:get-all-layers ( / rec out)
  (setq rec (tblnext "LAYER" T))
  (while rec
    (setq out (cons (cdr (assoc 2 rec)) out)
          rec (tblnext "LAYER")))
  (reverse out))

;;; Layers that are neither xref dependent nor one of the two AutoCAD
;;; reserves. This is the set every audit in the suite works on.
(defun bts:get-drawing-layers ( / nm out)
  (foreach nm (bts:get-all-layers)
    (if (and (not (wcmatch nm "*`|*"))
             (not (= (strcase nm) "0"))
             (not (= (strcase nm) "DEFPOINTS")))
      (setq out (cons nm out))))
  (reverse out))

;;; (on frozen locked plot) for a layer, or nil if it is not there.
(defun bts:lay-flags (nm / e f)
  (if (setq e (bts:lay-ent nm))
    (progn
      (setq e (entget e) f (cdr (assoc 70 e)))
      (list (>= (cdr (assoc 62 e)) 0)
            (= 1 (logand f 1))
            (= 4 (logand f 4))
            (= 1 (cond ((cdr (assoc 290 e))) (t 1)))))))

;;; A register linetype that is not loaded yet has to come off the .lin
;;; file before it can be assigned. Every current register entry is
;;; Continuous, so this is a no-op until the register grows one.
(defun bts:ensure-ltype (lt / fd)
  (if (and lt (/= (strcase lt) "BYLAYER") (null (tblsearch "LTYPE" lt)))
    (progn
      (setq fd (getvar "FILEDIA"))
      (setvar "FILEDIA" 0)
      (vl-catch-all-apply
        'command
        (list "_.-LINETYPE" "_L" lt
              (if (findfile "acadiso.lin") "acadiso.lin" "acad.lin") ""))
      (setvar "FILEDIA" fd)))
  (if (tblsearch "LTYPE" lt) T))

;;; Creates a layer from the register only. Refusing to invent layers is
;;; the point: a name that is not in the standard has no properties to
;;; create it with.
(defun bts:create-layer (nm / spec)
  (cond
    ((bts:lay-ent nm) nil)
    ((null (setq spec (bts:layer-spec nm))) nil)
    (t (bts:ensure-ltype (nth 2 spec))
       (bts:mk-layer nm (nth 1 spec) (nth 2 spec) (nth 3 spec) (nth 4 spec))
       (bts:set-lay-xdata nm (nth 6 spec) (nth 5 spec))
       T)))

;;; Forces every register property back onto an existing layer, the
;;; description and transparency included.
(defun bts:update-layer (nm / spec)
  (cond
    ((null (bts:lay-ent nm)) nil)
    ((null (setq spec (bts:layer-spec nm))) nil)
    (t (bts:ensure-ltype (nth 2 spec))
       (bts:set-dxf nm 62 (nth 1 spec))
       (bts:set-dxf nm 6 (if (= (nth 2 spec) "ByLayer") "Continuous" (nth 2 spec)))
       (bts:set-dxf nm 370 (nth 3 spec))
       (bts:set-dxf nm 290 (nth 4 spec))
       (bts:set-lay-xdata nm (nth 6 spec) (nth 5 spec))
       T)))

;;; Thaw, turn on and unlock through DXF rather than -LAYER keywords,
;;; so nothing depends on the command line dialect.
(defun bts:unlock-layer (nm / e)
  (if (setq e (bts:lay-ent nm))
    (progn
      (bts:set-dxf nm 70 (logand (cdr (assoc 70 (entget e))) (~ 5)))
      (bts:set-dxf nm 62 (abs (cdr (assoc 62 (entget e))))))))

;;; Safe removal. Returns (T . reason) or (nil . reason) - a layer is
;;; only ever purged once it is provably empty and not in the standard.
(defun bts:delete-layer (nm / n)
  (cond
    ((null (bts:lay-ent nm)) (list nil "not present"))
    ((= (strcase nm) "0") (list nil "layer 0 cannot be removed"))
    ((= (strcase nm) "DEFPOINTS") (list nil "DEFPOINTS is protected"))
    ((bts:lay-in-standard nm) (list nil "in the BTS standard"))
    ((= (strcase nm) (strcase (getvar "CLAYER"))) (list nil "is the current layer"))
    ((> (setq n (bts:count-on-layer nm)) 0)
     (list nil (strcat (itoa n) " object(s) still on it")))
    (t (command "_.-PURGE" "_LA" nm "_N")
       (if (bts:lay-ent nm)
         (list nil "empty but still referenced - layer state, filter or viewport override")
         (list T "purged")))))

;;; Moves every object off OLD onto NEW: model space, every layout and
;;; every block definition, with the per-viewport freeze carried across.
;;; Returns the object count, or nil if either layer is missing.
(defun bts:remap-layer (old new / n)
  (if (and (bts:lay-ent old) (bts:lay-ent new))
    (progn
      (bts:unlock-layer old)
      (setq n (+ (bts:move-selection old new '())
                 (bts:move-block-contents old new '() T)))
      (bts:vp-refreeze old new)
      (if (= (strcase (getvar "CLAYER")) (strcase old)) (setvar "CLAYER" new))
      n)))

;;; Splits a mixed legacy layer: fills to HAT, everything else to BND.
;;; Returns (boundary-count . fill-count).
(defun bts:split-layer (old bnd hat / nh nb)
  (if (and (bts:lay-ent old) (bts:lay-ent bnd) (bts:lay-ent hat))
    (progn
      (bts:unlock-layer old)
      (setq nh (+ (bts:move-selection old hat
                    '((-4 . "<OR") (0 . "HATCH") (0 . "SOLID") (-4 . "OR>")))
                  (bts:move-block-contents old hat '("HATCH" "SOLID") nil))
            nb (+ (bts:move-selection old bnd
                    '((-4 . "<NOT")
                      (-4 . "<OR") (0 . "HATCH") (0 . "SOLID") (-4 . "OR>")
                      (-4 . "NOT>")))
                  (bts:move-block-contents old bnd '("HATCH" "SOLID") T)))
      (bts:vp-refreeze old bnd)
      (if (= (strcase (getvar "CLAYER")) (strcase old)) (setvar "CLAYER" bnd))
      (cons nb nh))))

;;; ---- protected purge ----

(defun bts:purge-1 (kind nm)
  (command "_.-PURGE" kind nm "_N"))

(defun bts:block-gone (nm) (null (tblsearch "BLOCK" nm)))

;;; Purges unreferenced blocks, layers, linetypes, text styles,
;;; dimension styles and registered applications, holding back anything
;;; the standard or the keep lists names. Returns ((kind . n) ...).
(defun bts:purge-safe ( / rec nm f out n cands)
  (setq out '())

  (setq cands '() rec (tblnext "BLOCK" T))
  (while rec
    (setq nm (cdr (assoc 2 rec)) f (cdr (assoc 70 rec)))
    (if (and (not (wcmatch nm "`**"))                    ; not *Model_Space etc
             (zerop (logand f 4))                        ; not an xref
             (not (bts:wc-any nm *BTS-A-KEEP-BLOCKS*)))
      (setq cands (cons nm cands)))
    (setq rec (tblnext "BLOCK")))
  (setq n 0)
  (foreach nm cands
    (bts:purge-1 "_B" nm)
    (if (bts:block-gone nm) (setq n (1+ n))))
  (setq out (cons (cons "blocks" n) out))

  (setq cands '() n 0)
  (foreach nm (bts:get-drawing-layers)
    (if (and (null (bts:lay-in-standard nm))
             (/= (strcase nm) (strcase (getvar "CLAYER")))
             (= 0 (bts:count-on-layer nm)))
      (setq cands (cons nm cands))))
  (foreach nm cands
    (bts:purge-1 "_LA" nm)
    (if (null (bts:lay-ent nm)) (setq n (1+ n))))
  (setq out (cons (cons "layers" n) out))

  (setq cands '() n 0 rec (tblnext "LTYPE" T))
  (while rec
    (setq nm (cdr (assoc 2 rec)))
    (if (not (member (strcase nm) '("BYLAYER" "BYBLOCK" "CONTINUOUS")))
      (setq cands (cons nm cands)))
    (setq rec (tblnext "LTYPE")))
  (foreach nm cands
    (bts:purge-1 "_LT" nm)
    (if (null (tblsearch "LTYPE" nm)) (setq n (1+ n))))
  (setq out (cons (cons "linetypes" n) out))

  (setq cands '() n 0 rec (tblnext "STYLE" T))
  (while rec
    (setq nm (cdr (assoc 2 rec)))
    (if (and (/= nm "") (not (bts:wc-any nm *BTS-A-KEEP-STYLES*)))
      (setq cands (cons nm cands)))
    (setq rec (tblnext "STYLE")))
  (foreach nm cands
    (bts:purge-1 "_ST" nm)
    (if (null (tblsearch "STYLE" nm)) (setq n (1+ n))))
  (setq out (cons (cons "text styles" n) out))

  (setq cands '() n 0 rec (tblnext "DIMSTYLE" T))
  (while rec
    (setq nm (cdr (assoc 2 rec)))
    (if (and (/= (strcase nm) "STANDARD")
             (not (bts:wc-any nm *BTS-A-KEEP-STYLES*)))
      (setq cands (cons nm cands)))
    (setq rec (tblnext "DIMSTYLE")))
  (foreach nm cands
    (bts:purge-1 "_D" nm)
    (if (null (tblsearch "DIMSTYLE" nm)) (setq n (1+ n))))
  (setq out (cons (cons "dim styles" n) out))

  ;; Registered applications carry no geometry, so the wildcard is safe.
  (setq n (bts:appid-count))
  (bts:purge-1 "_R" "*")
  (setq out (cons (cons "regapps" (max 0 (- n (bts:appid-count)))) out))

  (reverse out))

(defun bts:appid-count ( / rec n)
  (setq n 0 rec (tblnext "APPID" T))
  (while rec (setq n (1+ n) rec (tblnext "APPID")))
  n)

;;; ------------------------------------------------------------------
;;;  Layouts, viewports and plot settings
;;; ------------------------------------------------------------------

;;; A LAYOUT object carries AcDbPlotSettings and AcDbLayout in the same
;;; entity list, and both use group 1 and group 70. Reading a code with
;;; plain assoc gets whichever comes first, so section is tracked here.
(defun bts:sec-get (e class code / on out p)
  (foreach p e
    (cond
      ((= (car p) 100) (setq on (= (cdr p) class)))
      ((and on (= (car p) code) (null out)) (setq out (cdr p)))))
  out)

(defun bts:plot-get (e code) (bts:sec-get e "AcDbPlotSettings" code))
(defun bts:layout-get (e code) (bts:sec-get e "AcDbLayout" code))

;;; (name ename tab-order), model tab included, in tab order.
(defun bts:get-layouts ( / d nm out p)
  (setq d (dictsearch (namedobjdict) "ACAD_LAYOUT"))
  (foreach p d
    (cond
      ((= (car p) 3) (setq nm (cdr p)))
      ((and (= (car p) 350) nm)
       (setq out (cons (list nm (cdr p)
                             (cond ((bts:layout-get (entget (cdr p)) 71)) (t 0)))
                       out)
             nm nil))))
  (bts:sort out '(lambda (a b) (< (caddr a) (caddr b)))))

(defun bts:get-sheets ( / l out)
  (foreach l (bts:get-layouts)
    (if (/= (strcase (car l)) "MODEL") (setq out (cons l out))))
  (reverse out))

;;; Real viewports on a layout. Every layout owns one background
;;; viewport with id 1 that represents the sheet itself - not a window
;;; onto the model, and never part of an audit.
(defun bts:vports (lname / ss i vp out)
  (if (setq ss (ssget "_X" (list '(0 . "VIEWPORT") (cons 410 lname))))
    (progn
      (setq i 0)
      (repeat (sslength ss)
        (setq vp (ssname ss i))
        (if (/= 1 (cond ((cdr (assoc 69 (entget vp)))) (t 1)))
          (setq out (cons vp out)))
        (setq i (1+ i)))))
  (reverse out))

(defun bts:all-vports ( / l out)
  (foreach l (bts:get-sheets)
    (setq out (append out (bts:vports (car l)))))
  out)

;;; Layers frozen in this viewport. AutoCAD has written the reference
;;; under both 331 and 341 over the years, so both are collected.
(defun bts:vp-frozen (vp / p out)
  (foreach p (entget vp)
    (if (member (car p) '(331 341)) (setq out (cons (cdr p) out))))
  (reverse out))

(defun bts:vp-frozen-names (vp / e out)
  (foreach e (bts:vp-frozen vp)
    (if (and e (entget e)) (setq out (cons (cdr (assoc 2 (entget e))) out))))
  (reverse out))

;;; Reads one viewport into an alist. Scale is paper units per model
;;; unit; bts:vp-denom turns that into the 1:N a drawing is issued at.
(defun bts:scan-viewport (vp / e f h vh)
  (setq e  (entget vp)
        f  (cond ((cdr (assoc 90 e))) (t 0))
        h  (cond ((cdr (assoc 41 e))) (t 0.0))
        vh (cond ((cdr (assoc 45 e))) (t 0.0)))
  (list
    (cons "ent"     vp)
    (cons "layout"  (cond ((cdr (assoc 410 e))) (t "?")))
    (cons "id"      (cond ((cdr (assoc 69 e))) (t 0)))
    (cons "layer"   (cdr (assoc 8 e)))
    (cons "centre"  (cdr (assoc 10 e)))
    (cons "w"       (cond ((cdr (assoc 40 e))) (t 0.0)))
    (cons "h"       h)
    (cons "vh"      vh)
    (cons "on"      (and (> (cond ((cdr (assoc 68 e))) (t 0)) 0)
                         (zerop (logand f 131072))))
    (cons "locked"  (not (zerop (logand f 16384))))
    (cons "clipped" (if (or (assoc 340 e) (not (zerop (logand f 65536)))) T))
    (cons "frozen"  (bts:vp-frozen-names vp))
    (cons "scale"   (if (> vh 1e-9) (/ h vh)))))

(defun bts:vp-get (vp-data key) (cdr (assoc key vp-data)))

;;; 1:N, reading the model in metres and the sheet in millimetres.
(defun bts:vp-denom (scale)
  (if (and scale (> scale 1e-9)) (/ 1000.0 scale)))

(defun bts:std-scale-p (n / s hit)
  (if n
    (foreach s *BTS-A-SCALES*
      (if (and (null hit) (bts:near n (float s) (* *BTS-A-SCALE-TOL* s)))
        (setq hit T))))
  hit)

(defun bts:scale-str (scale / n)
  (cond
    ((null scale) "no scale")
    ((setq n (bts:vp-denom scale)) (strcat "1:" (rtos n 2 (if (< n 10) 2 0))))
    (t "no scale")))

;;; Sets or clears the zoom lock bit on a viewport. Returns T when the
;;; state actually changed.
(defun bts:vp-lock (vp state / e f nf)
  (setq e (entget vp)
        f (cond ((cdr (assoc 90 e))) (t 0))
        nf (if state (logior f 16384) (logand f (~ 16384))))
  (if (/= f nf)
    (progn (entmod (subst (cons 90 nf) (assoc 90 e) e)) T)))

;;; Freezes or thaws LAY in one viewport, rewriting the whole reference
;;; set because entmod replaces the group, never merges it. Existing
;;; entries keep the code AutoCAD wrote them with; new ones use 341.
(defun bts:vp-freeze (vp lay state / le e out seen p cur changed)
  (setq le (bts:lay-ent lay))
  (if le
    (progn
      (setq e (entget vp) out '() seen '() changed nil)
      (foreach p e
        (if (not (member (car p) '(331 341)))
          (setq out (cons p out))
          (progn
            (setq cur (cdr p))
            (cond
              ((and (equal cur le) (null state)) (setq changed T))
              ((member cur seen) nil)
              (t (setq seen (cons cur seen)
                       out  (cons p out)))))))
      (if (and state (not (member le seen)))
        (setq out (cons (cons 341 le) out) changed T))
      (if changed (entmod (reverse out)))
      changed)))

;;; ------------------------------------------------------------------
;;;  Blocks and entities
;;; ------------------------------------------------------------------

;;; (name xref-p anonymous-p has-atts path) for every block definition,
;;; the *Model_Space and *Paper_Space records left out.
(defun bts:get-blocks ( / rec nm f out)
  (setq rec (tblnext "BLOCK" T))
  (while rec
    (setq nm (cdr (assoc 2 rec)) f (cond ((cdr (assoc 70 rec))) (t 0)))
    (if (not (wcmatch nm "`**"))
      (setq out (cons (list nm
                            (not (zerop (logand f 4)))
                            (not (zerop (logand f 1)))
                            (not (zerop (logand f 2)))
                            (cdr (assoc 1 rec)))
                      out)))
    (setq rec (tblnext "BLOCK")))
  (reverse out))

;;; Reference counts per block name, database inserts plus the nested
;;; inserts inside other definitions - a block used only by another
;;; block is still referenced and will not purge.
(defun bts:insert-census ( / ss i e rec bent out nm)
  (setq out '())
  (if (setq ss (ssget "_X" '((0 . "INSERT"))))
    (progn
      (setq i 0)
      (repeat (sslength ss)
        (setq out (bts:tally (cdr (assoc 2 (entget (ssname ss i)))) out)
              i   (1+ i)))))
  (setq rec (tblnext "BLOCK" T))
  (while rec
    (if (setq bent (cdr (assoc -2 rec)))
      (while bent
        (setq e (entget bent))
        (if (= (cdr (assoc 0 e)) "INSERT")
          (setq out (bts:tally (cdr (assoc 2 e)) out)))
        (setq bent (entnext bent))))
    (setq rec (tblnext "BLOCK")))
  out)

;;; Attributes of one INSERT as (tag . value) pairs.
(defun bts:atts (ins / e d out)
  (if (= 1 (cond ((cdr (assoc 66 (entget ins)))) (t 0)))
    (progn
      (setq e (entnext ins))
      (while (and e (setq d (entget e)) (= (cdr (assoc 0 d)) "ATTRIB"))
        (setq out (cons (cons (cdr (assoc 2 d))
                              (cond ((cdr (assoc 1 d))) (t "")))
                        out)
              e   (entnext e)))))
  (reverse out))

;;; Entities carrying the annotative flag hold it as xdata, not a DXF
;;; group, so the whole xdata set has to come back to see it.
(defun bts:annotative-p (e / xd)
  (if (setq xd (cdr (assoc -3 (entget e '("AcadAnnotative")))))
    (if (assoc "AcadAnnotative" xd) T)))

(defun bts:ent-census ( / ss i e out)
  (setq out '())
  (if (setq ss (ssget "_X"))
    (progn
      (setq i 0)
      (repeat (sslength ss)
        (setq out (bts:tally (cdr (assoc 0 (entget (ssname ss i)))) out)
              i   (1+ i)))))
  out)

(defun bts:count-type (ty / ss)
  (if (setq ss (ssget "_X" (list (cons 0 ty)))) (sslength ss) 0))

(defun bts:table-count (tbl / rec n)
  (setq n 0 rec (tblnext tbl T))
  (while rec (setq n (1+ n) rec (tblnext tbl)))
  n)

;;; Text out of a TEXT, MTEXT, ATTRIB or MULTILEADER entity, formatting
;;; codes stripped so the value can be compared or parsed.
(defun bts:ent-text (e / s p)
  (setq s (cond ((cdr (assoc 1 e))) (t "")))
  (if (= (cdr (assoc 0 e)) "MTEXT")
    (progn
      (foreach p e (if (= (car p) 3) (setq s (strcat (cdr p) s))))
      (setq s (bts:strip-mtext s))))
  s)

;;; Enough of the MTEXT format language to compare strings: braces,
;;; the \P newline and the \x... property runs.
(defun bts:strip-mtext (s / i c n out)
  (setq i 1 n (strlen s) out "")
  (while (<= i n)
    (setq c (substr s i 1))
    (cond
      ((= c "\\")
       (cond
         ((member (substr s (1+ i) 1) '("P" "p")) (setq out (strcat out " ") i (1+ i)))
         ((member (substr s (1+ i) 1) '("~")) (setq i (1+ i)))
         ((member (substr s (1+ i) 1) '("\\" "{" "}"))
          (setq out (strcat out (substr s (1+ i) 1)) i (1+ i)))
         (t (setq i (1+ i))
            (while (and (<= i n) (not (member (substr s i 1) '(";" " "))))
              (setq i (1+ i))))))
      ((member c '("{" "}")) nil)
      (t (setq out (strcat out c))))
    (setq i (1+ i)))
  out)

;;; ------------------------------------------------------------------
;;;  Check engines - drawing set up
;;; ------------------------------------------------------------------

(defun bts:check-units ( / v nm want cur out)
  (setq out '())
  (foreach v *BTS-A-UNITS*
    (setq nm   (nth 0 v)
          want (nth 1 v)
          cur  (vl-catch-all-apply 'getvar (list nm)))
    (cond
      ((vl-catch-all-error-p cur)
       (setq out (cons (bts:iss "UNITS" nm "variable not available in this release") out)))
      ((/= cur want)
       (setq out (cons (bts:iss "UNITS" nm
                                (strcat "is " (vl-princ-to-string cur)
                                        ", should be " (vl-princ-to-string want)
                                        " - " (nth 2 v)))
                       out)))))
  (if (= 0 (getvar "INSUNITS"))
    (setq out (cons (bts:iss "UNITS" "INSUNITS"
                             "unitless - blocks and xrefs will insert at the wrong size")
                    out)))
  (reverse out))

;;; Title block validation. Finds the inserts that look like a title
;;; block, then holds each one against *BTS-A-TITLE-ATTS*.
(defun bts:titleblock-inserts ( / ss i ins e out cand)
  (setq out '() cand '())
  (if (setq ss (ssget "_X" '((0 . "INSERT"))))
    (progn
      (setq i 0)
      (repeat (sslength ss)
        (setq ins (ssname ss i) e (entget ins))
        (cond
          ((bts:wc-any (cdr (assoc 2 e)) *BTS-A-TITLEBLOCKS*)
           (setq out (cons ins out)))
          ((> (length (bts:atts ins)) 3) (setq cand (cons ins cand))))
        (setq i (1+ i)))))
  ;; Nothing matched by name: fall back to any insert carrying a
  ;; plausible number of attributes, and say so in the report.
  (if out (list (reverse out) nil) (list (reverse cand) T)))

(defun bts:check-titleblock ( / found fallback ins atts rule tag hit val out n a)
  (setq found (bts:titleblock-inserts)
        fallback (cadr found)
        found (car found)
        out '())
  (cond
    ((null found)
     (setq out (list (bts:iss "TITLE" "(drawing)"
                              "no title block found - see *BTS-A-TITLEBLOCKS*"))))
    (t
     (if fallback
       (setq out (cons (bts:iss "TITLE" "(drawing)"
                                (strcat "no block name matched *BTS-A-TITLEBLOCKS* - "
                                        (itoa (length found))
                                        " attributed block(s) checked instead"))
                       out)))
     (setq n 0)
     (foreach ins found
       (setq n (1+ n)
             atts (bts:atts ins)
             tag (strcat (cdr (assoc 2 (entget ins)))
                         " @" (cond ((cdr (assoc 410 (entget ins)))) (t "?"))))
       (if (null atts)
         (setq out (cons (bts:iss "TITLE" tag "block has no attributes") out))
         (foreach rule *BTS-A-TITLE-ATTS*
           (setq hit nil val nil)
           (foreach a atts
             (if (and (null hit) (wcmatch (strcase (car a)) (strcase (car rule))))
               (setq hit (car a) val (bts:trim (cdr a)))))
           (cond
             ((and (null hit) (cadr rule))
              (setq out (cons (bts:iss "TITLE" tag
                                       (strcat "no attribute matching " (car rule)
                                               " - " (caddr rule)))
                              out)))
             ((null hit) nil)
             ((= val "")
              (setq out (cons (bts:iss "TITLE" tag
                                       (strcat hit " is blank - " (caddr rule)))
                              out)))
             ((bts:wc-any val *BTS-A-PLACEHOLDERS*)
              (setq out (cons (bts:iss "TITLE" tag
                                       (strcat hit " still reads \"" val "\" - "
                                               (caddr rule)))
                              out)))
             ((and (or (wcmatch (strcase hit) "*STATUS*")
                       (wcmatch (strcase hit) "*SUITAB*"))
                   (not (bts:member-ci (bts:no-space val) *BTS-A-STATUS-CODES*)))
              (setq out (cons (bts:iss "TITLE" tag
                                       (strcat hit " is \"" val
                                               "\" - not an ISO 19650 suitability code"))
                              out))))))
       (if (> n 1)
         (setq out (cons (bts:iss "TITLE" tag "second or later title block on this sheet")
                         out))))))
  (reverse out))

;;; Per-object appearance overrides. Release R prints its own scan;
;;; this one returns issues so the combined report can carry them, and
;;; counts per layer rather than per object.
(defun bts:check-overrides ( / ss i e lay col lt lw tr out p)
  (setq col '() lt '() lw '() tr '() out '())
  (if (setq ss (ssget "_X"))
    (progn
      (setq i 0)
      (repeat (sslength ss)
        (setq e (entget (ssname ss i)) lay (cdr (assoc 8 e)))
        (if (and (assoc 62 e) (/= (abs (cdr (assoc 62 e))) 256))
          (setq col (bts:tally lay col)))
        (if (and (assoc 6 e)
                 (not (member (strcase (cdr (assoc 6 e))) '("BYLAYER" "BYBLOCK"))))
          (setq lt (bts:tally lay lt)))
        (if (and (assoc 370 e) (>= (cdr (assoc 370 e)) 0))
          (setq lw (bts:tally lay lw)))
        (if (assoc 440 e) (setq tr (bts:tally lay tr)))
        (setq i (1+ i)))))
  (foreach p col
    (setq out (cons (bts:iss "OVERRIDE" (car p)
                             (strcat (itoa (cdr p)) " object(s) with BYOBJECT colour"))
                    out)))
  (foreach p lw
    (setq out (cons (bts:iss "OVERRIDE" (car p)
                             (strcat (itoa (cdr p)) " object(s) with BYOBJECT lineweight"))
                    out)))
  (foreach p tr
    (setq out (cons (bts:iss "OVERRIDE" (car p)
                             (strcat (itoa (cdr p)) " object(s) with BYOBJECT transparency"))
                    out)))
  ;; Linetype overrides are the standard on utility runs, so they are
  ;; reported outside the utility layers only.
  (foreach p lt
    (if (not (wcmatch (strcase (car p)) "BTS-U-*"))
      (setq out (cons (bts:iss "OVERRIDE" (car p)
                               (strcat (itoa (cdr p)) " object(s) with BYOBJECT linetype"))
                      out))))
  (reverse out))

;;; ------------------------------------------------------------------
;;;  Check engines - plotting and sheets
;;; ------------------------------------------------------------------

;;; Plot layout flags, group 70 of AcDbPlotSettings.
(defun bts:plot-flag (f bit) (not (zerop (logand f bit))))

(defun bts:check-plot ( / out l e f nm dev sty typ scl n vps vp d lay)
  (setq out '())
  (foreach l (bts:get-sheets)
    (setq nm  (car l)
          e   (entget (cadr l))
          f   (cond ((bts:plot-get e 70)) (t 0))
          dev (cond ((bts:plot-get e 2)) (t ""))
          sty (cond ((bts:plot-get e 7)) (t ""))
          typ (cond ((bts:plot-get e 74)) (t 0))
          scl (cond ((bts:plot-get e 147)) (t 0.0)))
    (if (or (= dev "") (= (strcase dev) "NONE"))
      (setq out (cons (bts:iss "PLOT" nm "no plotter or plot configuration set") out)))
    (if (= sty "")
      (setq out (cons (bts:iss "PLOT" nm "no plot style table (.ctb/.stb) set") out)))
    (if (= "" (cond ((bts:plot-get e 4)) (t "")))
      (setq out (cons (bts:iss "PLOT" nm "no paper size set") out)))
    (if (not (bts:plot-flag f 16))
      (setq out (cons (bts:iss "PLOT" nm "plot scale is custom, not a standard scale") out))
      (if (and (> scl 0.0) (not (bts:near scl 1.0 0.001)))
        (setq out (cons (bts:iss "PLOT" nm
                                 (strcat "sheet plots at " (rtos scl 2 4)
                                         ":1 - sheets plot 1:1, scale in the viewport"))
                        out))))
    (if (= typ 0)
      (setq out (cons (bts:iss "PLOT" nm "plot area is Display - set it to Layout") out)))
    (if (bts:plot-flag f 1)
      (setq out (cons (bts:iss "PLOT" nm "viewport borders are set to plot") out)))
    (if (bts:plot-flag f 2)
      (setq out (cons (bts:iss "PLOT" nm "plot styles are shown on screen (ShowPlotStyles)") out)))
    (if (null (setq vps (bts:vports nm)))
      (setq out (cons (bts:iss "PLOT" nm "sheet has no viewport") out))
      (foreach vp vps
        (setq d   (bts:scan-viewport vp)
              lay (bts:vp-get d "layer"))
        (if (null (bts:vp-get d "on"))
          (setq out (cons (bts:iss "PLOT" nm "a viewport on this sheet is switched off") out)))
        (if (not (bts:std-scale-p (bts:vp-denom (bts:vp-get d "scale"))))
          (setq out (cons (bts:iss "PLOT" nm
                                   (strcat "viewport at " (bts:scale-str (bts:vp-get d "scale"))
                                           " - not a standard scale"))
                          out)))
        (if (and (not (bts:member-ci lay '("BTS-L-VPort" "BTS-L-VPortNonPlot")))
                 (= 1 (nth 3 (cond ((bts:lay-flags lay)) (t '(T nil nil 1))))))
          (setq out (cons (bts:iss "PLOT" nm
                                   (strcat "viewport border is on plotting layer " lay))
                          out))))))

  ;; Content that will not reach paper, and the draft watermark.
  (foreach nm (bts:get-drawing-layers)
    (setq f (bts:lay-flags nm)
          n (bts:count-on-layer nm))
    (if (and f (> n 0))
      (progn
        (if (and (= 1 (nth 3 f)) (null (nth 0 f)))
          (setq out (cons (bts:iss "PLOT" nm
                                   (strcat "layer is OFF but set to plot - "
                                           (itoa n) " object(s) will not appear"))
                          out)))
        (if (and (= 1 (nth 3 f)) (nth 1 f))
          (setq out (cons (bts:iss "PLOT" nm
                                   (strcat "layer is FROZEN but set to plot - "
                                           (itoa n) " object(s) will not appear"))
                          out)))
        (if (and (= 0 (nth 3 f)) (> n 0) (bts:lay-in-standard nm) (nth 0 f))
          (setq out (cons (bts:iss "PLOT" nm
                                   (strcat (itoa n) " object(s) on a non-plotting layer"))
                          out))))))
  (setq f (bts:lay-flags "BTS-L-Draft"))
  (if (and f (> (bts:count-on-layer "BTS-L-Draft") 0) (nth 0 f) (null (nth 1 f)))
    (setq out (cons (bts:iss "PLOT" "BTS-L-Draft"
                             "DRAFT watermark is visible - freeze it before issue")
                    out)))
  (reverse out))

(defun bts:check-viewports ( / out l vp d nm frozen fz)
  (setq out '())
  (foreach l (bts:get-sheets)
    (foreach vp (bts:vports (car l))
      (setq d  (bts:scan-viewport vp)
            nm (strcat (car l) " vp" (itoa (bts:vp-get d "id"))))
      (if (null (bts:vp-get d "locked"))
        (setq out (cons (bts:iss "VPORT" nm "not locked - BTSVPLOCK") out)))
      (if (null (bts:vp-get d "on"))
        (setq out (cons (bts:iss "VPORT" nm "switched off") out)))
      (if (not (bts:std-scale-p (bts:vp-denom (bts:vp-get d "scale"))))
        (setq out (cons (bts:iss "VPORT" nm
                                 (strcat "scale " (bts:scale-str (bts:vp-get d "scale"))
                                         " is not in *BTS-A-SCALES*"))
                        out)))
      (if (not (bts:member-ci (bts:vp-get d "layer")
                              '("BTS-L-VPort" "BTS-L-VPortNonPlot")))
        (setq out (cons (bts:iss "VPORT" nm
                                 (strcat "is on layer " (bts:vp-get d "layer")
                                         " - use BTS-L-VPort or BTS-L-VPortNonPlot"))
                        out)))
      (setq frozen (bts:vp-get d "frozen"))
      (if frozen
        (setq out (cons (bts:iss "VPORT" nm
                                 (strcat (itoa (length frozen))
                                         " layer(s) frozen in this viewport"))
                        out)))
      (foreach fz *BTS-A-VPFREEZE*
        (if (and (bts:lay-ent fz) (not (bts:member-ci fz frozen)))
          (setq out (cons (bts:iss "VPORT" nm
                                   (strcat fz " is not frozen here - BTSVPFREEZE Standard"))
                          out))))))
  (reverse out))

(defun bts:check-layouts ( / out sheets l nm seen e)
  (setq out '() sheets (bts:get-sheets) seen '())
  (if (null sheets)
    (setq out (list (bts:iss "SHEET" "(drawing)" "no paper space layout")))
    (foreach l sheets
      (setq nm (car l) e (entget (cadr l)))
      (if (bts:member-ci nm *BTS-A-DEFAULT-LAYOUTS*)
        (setq out (cons (bts:iss "SHEET" nm "default layout name - rename or delete") out)))
      (if (bts:member-ci (strcase nm) seen)
        (setq out (cons (bts:iss "SHEET" nm "duplicate layout name") out))
        (setq seen (cons (strcase nm) seen)))
      (if (null (bts:vports nm))
        (setq out (cons (bts:iss "SHEET" nm "no viewport on this sheet") out)))
      (if (= "" (cond ((bts:plot-get e 1)) (t "")))
        (setq out (cons (bts:iss "SHEET" nm "no named page setup") out)))))
  (reverse out))

;;; A sheet audit: the layout, its viewports, and the title block that
;;; carries the approval metadata, gathered per sheet.
(defun bts:check-sheets ( / out l nm ss)
  (setq out (append (bts:check-layouts) (bts:check-viewports)))
  (foreach l (bts:get-sheets)
    (setq nm (car l))
    (if (null (setq ss (ssget "_X" (list '(0 . "INSERT") (cons 410 nm)))))
      (setq out (cons (bts:iss "SHEET" nm "no block on this sheet - title block missing?") out))
      (if (null (bts:sheet-titleblock nm))
        (setq out (cons (bts:iss "SHEET" nm
                                 "no block matching *BTS-A-TITLEBLOCKS* on this sheet")
                        out)))))
  (append out (bts:check-titleblock)))

(defun bts:sheet-titleblock (lname / ss i ins hit)
  (if (setq ss (ssget "_X" (list '(0 . "INSERT") (cons 410 lname))))
    (progn
      (setq i 0)
      (repeat (sslength ss)
        (setq ins (ssname ss i))
        (if (and (null hit)
                 (bts:wc-any (cdr (assoc 2 (entget ins))) *BTS-A-TITLEBLOCKS*))
          (setq hit ins))
        (setq i (1+ i)))))
  hit)

;;; ------------------------------------------------------------------
;;;  Check engines - blocks
;;; ------------------------------------------------------------------

(defun bts:check-blocks ( / out blk nm refs cnt rec bent e lay bad anon p)
  (setq out '() refs (bts:insert-census) anon 0)
  (foreach blk (bts:get-blocks)
    (setq nm  (nth 0 blk)
          cnt (cond ((cdr (bts:assoc-ci nm refs))) (t 0)))
    (cond
      ((nth 2 blk) (setq anon (1+ anon)))
      ((nth 1 blk)
       (if (and (nth 4 blk) (null (findfile (nth 4 blk))))
         (setq out (cons (bts:iss "BLOCK" nm
                                  (strcat "xref path not found: " (nth 4 blk)))
                         out))))
      ((bts:wc-any nm *BTS-A-JUNK-BLOCKS*)
       (setq out (cons (bts:iss "BLOCK" nm "bound xref or legacy template residue") out)))
      ((= cnt 0)
       (setq out (cons (bts:iss "BLOCK" nm "defined but never inserted - purge candidate") out)))
      ((and *BTS-A-BLOCK-NAMES* (not (bts:wc-any nm *BTS-A-BLOCK-NAMES*)))
       (setq out (cons (bts:iss "BLOCK" nm "name is not an approved pattern") out)))))
  (if (> anon 0)
    (setq out (cons (bts:iss "BLOCK" "(anonymous)"
                             (strcat (itoa anon)
                                     " anonymous block(s) - hatches, dynamic blocks, dimensions"))
                    out)))

  ;; Contents of the definitions: layers that are not in the standard,
  ;; and appearance set on the object instead of the layer.
  (setq rec (tblnext "BLOCK" T))
  (while rec
    (setq nm (cdr (assoc 2 rec)) bad '())
    (if (and (not (wcmatch nm "`**"))
             (zerop (logand (cond ((cdr (assoc 70 rec))) (t 0)) 4))
             (setq bent (cdr (assoc -2 rec))))
      (progn
        (while bent
          (setq e   (entget bent)
                lay (cdr (assoc 8 e)))
          (if (and (not (bts:lay-in-standard lay))
                   (/= lay "0")
                   (not (wcmatch lay "*`|*")))
            (setq bad (bts:tally lay bad)))
          (if (and (assoc 62 e) (/= (abs (cdr (assoc 62 e))) 256))
            (setq bad (bts:tally (strcat lay " (BYOBJECT colour)") bad)))
          (setq bent (entnext bent)))
        (foreach p bad
          (setq out (cons (bts:iss "BLOCK" nm
                                   (strcat (itoa (cdr p)) " object(s) on " (car p)))
                          out)))))
    (setq rec (tblnext "BLOCK")))
  (reverse out))

(defun bts:block-inventory ( / refs out blk nm rec bent n cnt)
  (setq refs (bts:insert-census) out '())
  (foreach blk (bts:get-blocks)
    (setq nm  (nth 0 blk)
          cnt (cond ((cdr (bts:assoc-ci nm refs))) (t 0))
          n   0
          rec (tblsearch "BLOCK" nm))
    (if (setq bent (cdr (assoc -2 rec)))
      (while bent (setq n (1+ n) bent (entnext bent))))
    (setq out (cons (list nm
                          (cond ((nth 1 blk) "xref")
                                ((nth 2 blk) "anonymous")
                                (t "block"))
                          cnt n
                          (if (nth 3 blk) "yes" "no")
                          (cond ((nth 4 blk)) (t "")))
                    out)))
  (bts:sort (reverse out) '(lambda (a b) (< (strcase (car a)) (strcase (car b))))))

;;; ------------------------------------------------------------------
;;;  Check engines - annotation
;;; ------------------------------------------------------------------

(defun bts:style-font (nm / rec)
  (if (setq rec (tblsearch "STYLE" nm)) (cond ((cdr (assoc 3 rec))) (t "")) ""))

(defun bts:check-text ( / out rec nm font w ob spec ss i e ty lay h sty
                          census heights used paper p)
  (setq out '() census '() heights '() used '())

  ;; The STYLE table first - a wrong width factor or a missing font
  ;; changes every string in the drawing.
  (setq rec (tblnext "STYLE" T))
  (while rec
    (setq nm   (cdr (assoc 2 rec))
          font (cond ((cdr (assoc 3 rec))) (t ""))
          w    (cond ((cdr (assoc 41 rec))) (t 1.0))
          ob   (cond ((cdr (assoc 50 rec))) (t 0.0)))
    (if (/= nm "")
      (progn
        (if (and (/= font "") (null (findfile font)))
          (setq out (cons (bts:iss "TEXT" nm
                                   (strcat "font " font " not found - AutoCAD will substitute"))
                          out)))
        (if (not (bts:near w 1.0 0.001))
          (setq out (cons (bts:iss "TEXT" nm
                                   (strcat "width factor " (rtos w 2 3) ", should be 1"))
                          out)))
        (if (not (bts:near ob 0.0 0.001))
          (setq out (cons (bts:iss "TEXT" nm "oblique angle is not zero") out)))
        (if (wcmatch (strcase nm) "PDF *")
          (setq out (cons (bts:iss "TEXT" nm "PDF import residue") out)))
        (if (setq spec (bts:assoc-ci nm *BTS-A-TEXT-STYLES*))
          (progn
            (if (and (nth 1 spec) (/= (strcase font) (strcase (nth 1 spec))))
              (setq out (cons (bts:iss "TEXT" nm
                                       (strcat "font is " font ", should be " (nth 1 spec)))
                              out)))))))
    (setq rec (tblnext "STYLE")))
  (foreach spec *BTS-A-TEXT-STYLES*
    (if (null (tblsearch "STYLE" (car spec)))
      (setq out (cons (bts:iss "TEXT" (car spec) "approved text style is missing") out))))

  ;; Then the strings themselves, counted rather than listed.
  (if (setq ss (ssget "_X" '((-4 . "<OR") (0 . "TEXT") (0 . "MTEXT") (-4 . "OR>"))))
    (progn
      (setq i 0)
      (repeat (sslength ss)
        (setq e     (entget (ssname ss i))
              ty    (cdr (assoc 0 e))
              lay   (cdr (assoc 8 e))
              sty   (cond ((cdr (assoc 7 e))) (t "Standard"))
              h     (cond ((cdr (assoc 40 e))) (t 0.0))
              paper (or (bts:annotative-p (ssname ss i))
                        (/= (strcase (cond ((cdr (assoc 410 e))) (t "MODEL"))) "MODEL")))
        (setq used (bts:tally sty used)
              census (bts:tally (strcat sty " @ " (rtos h 2 3) " on " lay) census))
        (if (and paper *BTS-A-TEXT-HEIGHTS*)
          (if (null (bts:height-ok h))
            (setq heights (bts:tally (strcat (rtos h 2 2) " mm on " lay) heights))))
        (if (= (bts:trim (bts:ent-text e)) "")
          (setq out (cons (bts:iss "TEXT" lay "empty text object") out)))
        (if (and *BTS-A-TEXT-STYLES* (null (bts:assoc-ci sty *BTS-A-TEXT-STYLES*)))
          (setq out (cons (bts:iss "TEXT" lay (strcat "uses unapproved style " sty)) out)))
        (if (and (= ty "TEXT") (not (wcmatch (strcase lay) "BTS-A-ANNO-*"))
                 (not (wcmatch (strcase lay) "BTS-U-*-LABEL"))
                 (not (wcmatch (strcase lay) "BTS-S-GRID"))
                 (not (wcmatch (strcase lay) "BTS-L-*")))
          (setq out (cons (bts:iss "TEXT" lay "text is not on an annotation layer") out)))
        (setq i (1+ i)))))
  (setq out (bts:uniq (reverse out)))
  (foreach p heights
    (setq out (append out
                      (list (bts:iss "TEXT" "(sheet text)"
                                     (strcat (itoa (cdr p)) " object(s) at " (car p)
                                             " - not a standard sheet height"))))))
  (if (cdr (bts:assoc-ci "Standard" used))
    (setq out (append out
                      (list (bts:iss "TEXT" "Standard"
                                     (strcat (itoa (cdr (bts:assoc-ci "Standard" used)))
                                             " object(s) still on the Standard style"))))))
  (setq *BTS-A-LAST-CENSUS* census)
  out)

(defun bts:height-ok (h / x hit)
  (foreach x *BTS-A-TEXT-HEIGHTS*
    (if (and (null hit) (bts:near h x (max *BTS-A-TEXT-TOL* (* 0.01 x)))) (setq hit T)))
  hit)

;;; A dimension carries its style overrides as xdata under ACAD, with
;;; DSTYLE naming the group. Their presence is the whole finding.
(defun bts:dim-override-p (en / xd app)
  (if (setq xd (cdr (assoc -3 (entget en '("ACAD")))))
    (progn
      (setq app (cdr (assoc "ACAD" xd)))
      (if (bts:xd-has app "DSTYLE") T))))

(defun bts:xd-has (lst s / p hit)
  (foreach p lst
    (if (and (null hit) (= (car p) 1000) (= (strcase (cdr p)) (strcase s)))
      (setq hit T)))
  hit)

(defun bts:check-dims ( / out rec nm ss i en e lay sty ovr wrong styles p spec)
  (setq out '() ovr '() wrong '() styles '())
  (setq rec (tblnext "DIMSTYLE" T))
  (while rec
    (setq nm (cdr (assoc 2 rec)))
    (if (and *BTS-A-DIM-STYLES* (/= (strcase nm) "STANDARD")
             (null (bts:assoc-ci nm *BTS-A-DIM-STYLES*)))
      (setq out (cons (bts:iss "DIM" nm "dimension style is not on the approved list") out)))
    (setq rec (tblnext "DIMSTYLE")))
  (foreach spec *BTS-A-DIM-STYLES*
    (if (null (tblsearch "DIMSTYLE" (car spec)))
      (setq out (cons (bts:iss "DIM" (car spec) "approved dimension style is missing") out))))

  (if (setq ss (ssget "_X" '((0 . "DIMENSION"))))
    (progn
      (setq i 0)
      (repeat (sslength ss)
        (setq en  (ssname ss i)
              e   (entget en)
              lay (cdr (assoc 8 e))
              sty (cond ((cdr (assoc 3 e))) (t "Standard")))
        (setq styles (bts:tally sty styles))
        (if (bts:dim-override-p en) (setq ovr (bts:tally lay ovr)))
        (if (/= (strcase lay) "BTS-A-ANNO-DIMSLEADERS")
          (setq wrong (bts:tally lay wrong)))
        (setq i (1+ i)))))
  (foreach p ovr
    (setq out (cons (bts:iss "DIM" (car p)
                             (strcat (itoa (cdr p)) " dimension(s) carry style overrides"))
                    out)))
  (foreach p wrong
    (setq out (cons (bts:iss "DIM" (car p)
                             (strcat (itoa (cdr p))
                                     " dimension(s) not on BTS-A-ANNO-DimsLeaders"))
                    out)))
  (if (and (> (bts:count-type "DIMENSION") 0) (= 0 (getvar "DIMASSOC")))
    (setq out (cons (bts:iss "DIM" "(drawing)"
                             "DIMASSOC is 0 - dimensions are exploded, not associative")
                    out)))
  (setq *BTS-A-LAST-DIMSTYLES* styles)
  (reverse out))

;;; MLEADERSTYLE lives in a dictionary rather than a symbol table, so
;;; the style name comes from a handle to name map built once.
(defun bts:mleader-styles ( / d nm out p)
  (if (setq d (dictsearch (namedobjdict) "ACAD_MLEADERSTYLE"))
    (foreach p d
      (cond
        ((= (car p) 3) (setq nm (cdr p)))
        ((and (= (car p) 350) nm)
         (setq out (cons (cons (cdr p) nm) out) nm nil)))))
  out)

(defun bts:check-leaders ( / out map ss i en e lay sty nm wrong styles p spec)
  (setq out '() map (bts:mleader-styles) wrong '() styles '())
  (foreach p map
    (if (and *BTS-A-MLEAD-STYLES* (null (bts:assoc-ci (cdr p) *BTS-A-MLEAD-STYLES*)))
      (setq out (cons (bts:iss "LEADER" (cdr p) "leader style is not on the approved list") out))))
  (foreach spec *BTS-A-MLEAD-STYLES*
    (if (null (bts:rassoc-ci (car spec) map))
      (setq out (cons (bts:iss "LEADER" (car spec) "approved leader style is missing") out))))

  (if (setq ss (ssget "_X" '((-4 . "<OR") (0 . "MULTILEADER") (0 . "LEADER") (-4 . "OR>"))))
    (progn
      (setq i 0)
      (repeat (sslength ss)
        (setq en  (ssname ss i)
              e   (entget en)
              lay (cdr (assoc 8 e))
              sty (cdr (assoc 340 e))
              nm  (cond ((cdr (assoc sty map))) (t "(unknown)")))
        (setq styles (bts:tally nm styles))
        (if (and (not (wcmatch (strcase lay) "BTS-A-ANNO-*"))
                 (not (wcmatch (strcase lay) "BTS-U-*-LABEL")))
          (setq wrong (bts:tally lay wrong)))
        (if (= (cdr (assoc 0 e)) "LEADER")
          (setq out (cons (bts:iss "LEADER" lay
                                   "legacy LEADER object - replace with a multileader")
                          out)))
        (setq i (1+ i)))))
  (setq out (bts:uniq out))
  (foreach p wrong
    (setq out (cons (bts:iss "LEADER" (car p)
                             (strcat (itoa (cdr p))
                                     " leader(s) not on an annotation or label layer"))
                    out)))
  (setq *BTS-A-LAST-MLSTYLES* styles)
  (reverse out))

(defun bts:rassoc-ci (v lst / p hit)
  (foreach p lst
    (if (and (null hit) (= (type (cdr p)) 'STR) (= (strcase (cdr p)) (strcase v)))
      (setq hit p)))
  hit)

;;; ------------------------------------------------------------------
;;;  Check engines - utility survey
;;; ------------------------------------------------------------------

;;; "BTS-U-ELEC-Apparatus" gives "ELEC".
(defun bts:service (lay / s p)
  (if (wcmatch (strcase lay) "BTS-U-*")
    (progn
      (setq s (substr lay 7))
      (if (setq p (vl-string-search "-" s)) (substr s 1 p) s))))

(defun bts:services ( / spec svc out)
  (foreach spec *BTS-LAYERS*
    (if (and (setq svc (bts:service (car spec)))
             (not (bts:member-ci svc out)))
      (setq out (cons svc out))))
  (bts:sort-alpha out))

(defun bts:count-filter (flt / ss)
  (if (setq ss (ssget "_X" flt)) (sslength ss) 0))

(defun bts:count-on-wc (wc / ss)
  (if (setq ss (ssget "_X" (list (cons 8 wc)))) (sslength ss) 0))

;;; Apparatus layers only - what is drawn as the service run and its
;;; fittings. The label, easement and stand-off layers are left alone:
;;; an apparatus layer with no matching label is a survey decision, not
;;; a standards deviation, and BTSCHECK already audits every register
;;; layer whether or not anything is on it.
(defun bts:check-utility ( / out svc app lab n)
  (setq out '())
  (foreach svc (bts:services)
    (setq app (strcat "BTS-U-" svc "-Apparatus")
          lab (strcat "BTS-U-" svc "-Label"))
    (if (> (setq n (bts:count-on-wc app)) 0)
      (progn
        (if (= (strcase svc) "UNKN")
          (setq out (cons (bts:iss "UTIL" app
                                   (strcat (itoa n)
                                           " object(s) still recorded as UNKNOWN"))
                          out)))
        (if (> (bts:count-filter (list (cons 8 app)
                                       '(-4 . "<OR") '(0 . "TEXT") '(0 . "MTEXT")
                                       '(-4 . "OR>")))
               0)
          (setq out (cons (bts:iss "UTIL" app (strcat "annotation found here - move it to " lab))
                          out)))
        (if (> (bts:count-filter (list (cons 8 app) '(0 . "HATCH"))) 0)
          (setq out (cons (bts:iss "UTIL" app "hatch found on an apparatus layer") out))))))
  (reverse out))

(defun bts:check-ltype ( / out lay ss i e lt rule used ltsc)
  (setq out '() used '())
  (foreach lay (bts:get-drawing-layers)
    (if (and (wcmatch (strcase lay) "BTS-U-*")
             (> (bts:count-on-wc lay) 0))
      (progn
        (setq ss (ssget "_X" (list (cons 8 lay))) i 0)
        (repeat (sslength ss)
          (setq e  (entget (ssname ss i))
                lt (cond ((cdr (assoc 6 e))) (t "ByLayer")))
          (setq used (bts:tally (strcat lay " : " lt) used))
          (if (= (strcase lt) "BYBLOCK")
            (setq out (cons (bts:iss "LTYPE" lay "object linetype is ByBlock outside a block")
                            out)))
          (if (and (/= (strcase lt) "BYLAYER") (null (tblsearch "LTYPE" lt)))
            (setq out (cons (bts:iss "LTYPE" lay (strcat "linetype " lt " is not loaded")) out)))
          (if (and (assoc 48 e) (not (bts:near (cdr (assoc 48 e)) 1.0 0.001)))
            (setq out (cons (bts:iss "LTYPE" lay
                                     (strcat "object linetype scale "
                                             (rtos (cdr (assoc 48 e)) 2 3) " - should be 1"))
                            out)))
          (if (setq rule (bts:ltype-rule lay))
            (if (not (bts:wc-any lt (cdr rule)))
              (setq out (cons (bts:iss "LTYPE" lay
                                       (strcat "linetype " lt " is not approved for this service"))
                              out))))
          (setq i (1+ i))))))
  (setq out (bts:uniq out))
  (setq ltsc (getvar "LTSCALE"))
  (if (or (< ltsc 0.01) (> ltsc 100.0))
    (setq out (append out (list (bts:iss "LTYPE" "(drawing)"
                                        (strcat "LTSCALE is " (rtos ltsc 2 3)
                                                " - dashes will not read at plot scale"))))))
  (if (/= 1 (getvar "PSLTSCALE"))
    (setq out (append out (list (bts:iss "LTYPE" "(drawing)" "PSLTSCALE is not 1")))))
  (if (/= 1 (getvar "MSLTSCALE"))
    (setq out (append out (list (bts:iss "LTYPE" "(drawing)" "MSLTSCALE is not 1")))))
  (setq *BTS-A-LAST-LTYPES* used)
  out)

(defun bts:ltype-rule (lay / r hit)
  (foreach r *BTS-A-UTIL-LTYPE*
    (if (and (null hit) (wcmatch (strcase lay) (strcase (car r)))) (setq hit r)))
  hit)

;;; PAS 128 quality level attribution.
(defun bts:ql-token (s / t1 hit w)
  (setq t1 (strcase (bts:no-space s)))
  (foreach w *BTS-A-QL-WC*
    (if (and (null hit) (wcmatch t1 (strcat "*" w "*"))) (setq hit w)))
  hit)

(defun bts:check-ql ( / out ss i e s lay tok census apparatus n other p svc)
  (setq out '() census '() other '() apparatus 0 n 0)
  (foreach svc (bts:services)
    (setq apparatus (+ apparatus (bts:count-on-wc (strcat "BTS-U-" svc "-Apparatus")))))
  (if (setq ss (ssget "_X" (list (cons 8 *BTS-A-QL-LAYER*)
                                 '(-4 . "<OR") '(0 . "TEXT") '(0 . "MTEXT") '(-4 . "OR>"))))
    (progn
      (setq i 0)
      (repeat (sslength ss)
        (setq e (entget (ssname ss i))
              s (bts:trim (bts:ent-text e))
              n (1+ n))
        (if (setq tok (bts:ql-token s))
          (setq census (bts:tally tok census))
          (if (/= s "")
            (setq out (cons (bts:iss "QL" *BTS-A-QL-LAYER*
                                     (strcat "\"" s "\" is not a PAS 128 quality level"))
                            out))))
        (setq i (1+ i)))))
  (if (and (> apparatus 0) (= n 0))
    (setq out (cons (bts:iss "QL" *BTS-A-QL-LAYER*
                             (strcat "no quality level annotation for "
                                     (itoa apparatus) " utility object(s)"))
                    out)))
  ;; QL text sitting on any other layer is attribution nobody can find.
  (if (setq ss (ssget "_X" '((-4 . "<OR") (0 . "TEXT") (0 . "MTEXT") (-4 . "OR>"))))
    (progn
      (setq i 0)
      (repeat (sslength ss)
        (setq e   (entget (ssname ss i))
              lay (cdr (assoc 8 e))
              s   (bts:trim (bts:ent-text e)))
        (if (and (/= (strcase lay) (strcase *BTS-A-QL-LAYER*))
                 (bts:ql-token s))
          (setq other (bts:tally lay other)))
        (setq i (1+ i)))))
  (foreach p other
    (setq out (cons (bts:iss "QL" (car p)
                             (strcat (itoa (cdr p)) " quality level string(s) off "
                                     *BTS-A-QL-LAYER*))
                    out)))
  (setq *BTS-A-LAST-QL* census)
  (reverse out))

(defun bts:segs-on-layer (lay / ss i en e ty pts p prev out skipped closed)
  (setq out '() skipped 0)
  (if (setq ss (ssget "_X" (list (cons 8 lay))))
    (progn
      (setq i 0)
      (repeat (sslength ss)
        (setq en (ssname ss i) e (entget en) ty (cdr (assoc 0 e)) pts '())
        (cond
          ((= ty "LINE")
           (setq out (cons (list (bts:2d (cdr (assoc 10 e)))
                                 (bts:2d (cdr (assoc 11 e))))
                           out)))
          ((= ty "LWPOLYLINE")
           (foreach p e (if (= (car p) 10) (setq pts (cons (bts:2d (cdr p)) pts))))
           (setq pts (reverse pts)
                 closed (= 1 (logand 1 (cond ((cdr (assoc 70 e))) (t 0)))))
           (setq out (append (bts:chain pts closed) out)))
          ((= ty "POLYLINE")
           (setq p (entnext en))
           (while (and p (= (cdr (assoc 0 (entget p))) "VERTEX"))
             (setq pts (cons (bts:2d (cdr (assoc 10 (entget p)))) pts)
                   p   (entnext p)))
           (setq pts (reverse pts)
                 closed (= 1 (logand 1 (cond ((cdr (assoc 70 e))) (t 0)))))
           (setq out (append (bts:chain pts closed) out)))
          ((member ty '("ARC" "CIRCLE" "SPLINE" "ELLIPSE")) (setq skipped (1+ skipped))))
        (setq i (1+ i)))))
  (list out skipped))

(defun bts:2d (p) (list (car p) (cadr p)))

(defun bts:chain (pts closed / out prev p)
  (setq prev nil)
  (foreach p pts
    (if prev (setq out (cons (list prev p) out)))
    (setq prev p))
  (if (and closed prev (cadr pts))
    (setq out (cons (list prev (car pts)) out)))
  out)

(defun bts:bbox (segs / xmin xmax ymin ymax s p)
  (foreach s segs
    (foreach p s
      (setq xmin (if xmin (min xmin (car p)) (car p))
            xmax (if xmax (max xmax (car p)) (car p))
            ymin (if ymin (min ymin (cadr p)) (cadr p))
            ymax (if ymax (max ymax (cadr p)) (cadr p)))))
  (if xmin (list xmin ymin xmax ymax)))

(defun bts:bbox-hit (a b tol)
  (and a b
       (<= (- (car a) tol) (+ (caddr b) tol))
       (<= (- (car b) tol) (+ (caddr a) tol))
       (<= (- (cadr a) tol) (+ (cadddr b) tol))
       (<= (- (cadr b) tol) (+ (cadddr a) tol))))

;;; 2D segment intersection. Returns the crossing point, or nil for
;;; parallel, collinear or non-overlapping segments.
(defun bts:seg-x (p1 p2 p3 p4 / d ua ub x1 y1 x2 y2 x3 y3 x4 y4)
  (setq x1 (car p1) y1 (cadr p1) x2 (car p2) y2 (cadr p2)
        x3 (car p3) y3 (cadr p3) x4 (car p4) y4 (cadr p4)
        d  (- (* (- x2 x1) (- y4 y3)) (* (- y2 y1) (- x4 x3))))
  (if (> (abs d) 1e-10)
    (progn
      (setq ua (/ (- (* (- x4 x3) (- y1 y3)) (* (- y4 y3) (- x1 x3))) d)
            ub (/ (- (* (- x2 x1) (- y1 y3)) (* (- y2 y1) (- x1 x3))) d))
      (if (and (>= ua 0.0) (<= ua 1.0) (>= ub 0.0) (<= ub 1.0))
        (list (+ x1 (* ua (- x2 x1))) (+ y1 (* ua (- y2 y1))))))))

;;; Distance from a point to a segment, for the near-miss test.
;;; Cheap axis aligned reject, so the distance maths only runs on the
;;; segment pairs that could possibly be within the clearance.
(defun bts:seg-far (s1 s2 tol)
  (or (> (- (min (car (car s1)) (car (cadr s1))) tol)
         (max (car (car s2)) (car (cadr s2))))
      (> (- (min (car (car s2)) (car (cadr s2))) tol)
         (max (car (car s1)) (car (cadr s1))))
      (> (- (min (cadr (car s1)) (cadr (cadr s1))) tol)
         (max (cadr (car s2)) (cadr (cadr s2))))
      (> (- (min (cadr (car s2)) (cadr (cadr s2))) tol)
         (max (cadr (car s1)) (cadr (cadr s1))))))

(defun bts:pt-seg-d (p a b / dx dy l2 u px py)
  (setq dx (- (car b) (car a))
        dy (- (cadr b) (cadr a))
        l2 (+ (* dx dx) (* dy dy)))
  (if (< l2 1e-12)
    (distance p a)
    (progn
      (setq u (/ (+ (* (- (car p) (car a)) dx) (* (- (cadr p) (cadr a)) dy)) l2)
            u (max 0.0 (min 1.0 u))
            px (+ (car a) (* u dx))
            py (+ (cadr a) (* u dy)))
      (distance p (list px py)))))

(defun bts:util-runs ( / svc lay segs r out n)
  (setq out '() n 0)
  (foreach svc (bts:services)
    (setq lay  (strcat "BTS-U-" svc "-Apparatus")
          r    (bts:segs-on-layer lay)
          segs (car r))
    (if segs
      (setq out (cons (list svc (bts:bbox segs) segs (cadr r)) out)
            n   (+ n (length segs)))))
  (list (reverse out) n))

;;; Crossings and near misses between different services. Only the
;;; apparatus layers are tested - easements and stand-off zones are
;;; meant to overlap.
(defun bts:check-conflicts ( / runs total out a b i j hits pts
                               s1 s2 x d skipped p)
  (setq runs (bts:util-runs) total (cadr runs) runs (car runs) out '() skipped 0)
  (foreach a runs (setq skipped (+ skipped (nth 3 a))))
  (cond
    ((null runs)
     (list (bts:iss "CLASH" "(drawing)" "no utility apparatus to test")))
    ((and (> total *BTS-A-CLASH-MAX*)
          (/= "Yes" (bts:ask (strcat (itoa total)
                                     " segment(s) to test, this will be slow. Continue?")
                             "No")))
     (list (bts:iss "CLASH" "(drawing)"
                    (strcat (itoa total) " segment(s) - test declined"))))
    (t
     (setq i 0)
     (repeat (length runs)
       (setq a (nth i runs) j (1+ i))
       (repeat (- (length runs) j)
         (setq b (nth j runs) hits 0 pts '())
         (if (bts:bbox-hit (nth 1 a) (nth 1 b) *BTS-A-CLEARANCE*)
           (foreach s1 (nth 2 a)
             (foreach s2 (nth 2 b)
               (cond
                 ((bts:seg-far s1 s2 *BTS-A-CLEARANCE*) nil)
                 ((setq x (bts:seg-x (car s1) (cadr s1) (car s2) (cadr s2)))
                  (setq hits (1+ hits))
                  (if (< (length pts) *BTS-A-CLASH-LIST*)
                    (setq pts (cons (cons "X" x) pts))))
                 ((< (setq d (min (bts:pt-seg-d (car s1) (car s2) (cadr s2))
                                  (bts:pt-seg-d (cadr s1) (car s2) (cadr s2))
                                  (bts:pt-seg-d (car s2) (car s1) (cadr s1))
                                  (bts:pt-seg-d (cadr s2) (car s1) (cadr s1))))
                       *BTS-A-CLEARANCE*)
                  (setq hits (1+ hits))
                  (if (< (length pts) *BTS-A-CLASH-LIST*)
                    (setq pts (cons (cons (strcat "~" (rtos d 2 2) "m") (car s1)) pts))))))))
         (if (> hits 0)
           (progn
             (setq out (cons (bts:iss "CLASH" (strcat (car a) " / " (car b))
                                      (strcat (itoa hits)
                                              " crossing(s) or clearance breach(es) under "
                                              (rtos *BTS-A-CLEARANCE* 2 2) "m"))
                             out))
             (foreach p (reverse pts)
               (setq out (cons (bts:iss "CLASH" (strcat (car a) " / " (car b))
                                        (strcat "   " (car p) " at "
                                                (rtos (car (cdr p)) 2 3) ", "
                                                (rtos (cadr (cdr p)) 2 3)))
                               out)))))
         (setq j (1+ j)))
       (setq i (1+ i)))
     (if (> skipped 0)
       (setq out (cons (bts:iss "CLASH" "(drawing)"
                                (strcat (itoa skipped)
                                        " arc, circle or spline object(s) not tested"))
                       out)))
     (reverse out))))

;;; ------------------------------------------------------------------
;;;  Check engines - GIS
;;; ------------------------------------------------------------------

;;; Ordnance Survey 100 km square for an easting and northing, the
;;; standard two letter reference. nil when the point is off the grid.
(defun bts:bng-square (e n / e100 n100 l1 l2)
  (setq e100 (fix (/ e 100000.0))
        n100 (fix (/ n 100000.0)))
  (if (and (>= e 0.0) (>= n 0.0) (<= e100 6) (<= n100 12))
    (progn
      (setq l1 (+ (- (- 19 n100) (rem (- 19 n100) 5)) (fix (/ (+ e100 10) 5)))
            l2 (+ (rem (* (- 19 n100) 5) 25) (rem e100 5)))
      ;; The letter I is not used, so everything from J up shifts one.
      (if (> l1 7) (setq l1 (1+ l1)))
      (if (> l2 7) (setq l2 (1+ l2)))
      (strcat (chr (+ 65 l1)) (chr (+ 65 l2))))))

(defun bts:extents ( / mn mx)
  (setq mn (getvar "EXTMIN") mx (getvar "EXTMAX"))
  (if (and mn mx (< (car mn) (car mx))) (list mn mx)))

(defun bts:check-bng ( / out ex mn mx cx cy w h sq)
  (setq out '())
  (if (/= 6 (getvar "INSUNITS"))
    (setq out (cons (bts:iss "BNG" "INSUNITS"
                             "not metres - BNG coordinates are metres")
                    out)))
  (if (null (setq ex (bts:extents)))
    (setq out (cons (bts:iss "BNG" "(drawing)" "no geometry to test") out))
    (progn
      (setq mn (car ex) mx (cadr ex)
            cx (/ (+ (car mn) (car mx)) 2.0)
            cy (/ (+ (cadr mn) (cadr mx)) 2.0)
            w  (- (car mx) (car mn))
            h  (- (cadr mx) (cadr mn)))
      (if (or (< (car mn) (car *BTS-A-BNG-E*)) (> (car mx) (cadr *BTS-A-BNG-E*))
              (< (cadr mn) (car *BTS-A-BNG-N*)) (> (cadr mx) (cadr *BTS-A-BNG-N*)))
        (setq out (cons (bts:iss "BNG" "(extents)"
                                 (strcat "geometry outside the National Grid envelope: "
                                         (rtos (car mn) 2 1) "," (rtos (cadr mn) 2 1)
                                         " to " (rtos (car mx) 2 1) "," (rtos (cadr mx) 2 1)))
                        out)))
      (if (and (< (abs cx) *BTS-A-ORIGIN-TOL*) (< (abs cy) *BTS-A-ORIGIN-TOL*))
        (setq out (cons (bts:iss "BNG" "(extents)"
                                 "geometry sits on the drawing origin - survey is not georeferenced")
                        out)))
      (if (or (> w *BTS-A-SITE-MAX*) (> h *BTS-A-SITE-MAX*))
        (setq out (cons (bts:iss "BNG" "(extents)"
                                 (strcat "extents span " (rtos w 2 0) " x " (rtos h 2 0)
                                         " m - stray geometry a long way from site?"))
                        out)))
      (if (setq sq (bts:bng-square cx cy))
        nil
        (setq out (cons (bts:iss "BNG" "(extents)"
                                 "centre of the drawing is not in a National Grid square")
                        out)))))
  (if (or (not (equal (getvar "UCSORG") '(0.0 0.0 0.0) 1e-8))
          (not (equal (getvar "UCSXDIR") '(1.0 0.0 0.0) 1e-8)))
    (setq out (cons (bts:iss "BNG" "UCS"
                             "the current UCS is not World - coordinates will read wrong")
                    out)))
  (if (not (bts:near (getvar "SNAPANG") 0.0 1e-8))
    (setq out (cons (bts:iss "BNG" "SNAPANG" "the model space view is rotated") out)))
  (if (/= 0 (getvar "ANGDIR"))
    (setq out (cons (bts:iss "BNG" "ANGDIR" "angles measure clockwise - bearings will read wrong")
                    out)))
  (reverse out))

;;; Grid consistency. Lines on the grid layer must be orthogonal and
;;; evenly spaced, and every label must agree with the line it sits on.
(defun bts:check-grid ( / out lay ss i en e ty p1 p2 xs ys skew s v lab step p)
  (setq out '() lay "BTS-S-Grid" xs '() ys '() skew 0)
  (cond
    ((null (bts:lay-ent lay))
     (list (bts:iss "GRID" lay "grid layer is not in the drawing")))
    ((= 0 (bts:count-on-wc lay))
     (list (bts:iss "GRID" lay "no grid drawn")))
    (t
     (if (setq ss (ssget "_X" (list (cons 8 lay)
                                    '(-4 . "<OR") '(0 . "LINE") '(0 . "LWPOLYLINE")
                                    '(-4 . "OR>"))))
       (progn
         (setq i 0)
         (repeat (sslength ss)
           (setq en (ssname ss i) e (entget en) ty (cdr (assoc 0 e)) p1 nil p2 nil)
           (cond
             ((= ty "LINE")
              (setq p1 (bts:2d (cdr (assoc 10 e))) p2 (bts:2d (cdr (assoc 11 e)))))
             ((= ty "LWPOLYLINE")
              (setq v '())
              (foreach p e (if (= (car p) 10) (setq v (cons (bts:2d (cdr p)) v))))
              (if (= 2 (length v)) (setq p1 (car v) p2 (cadr v)))))
           (if (and p1 p2)
             (cond
               ((bts:near (car p1) (car p2) 0.001)
                (setq xs (cons (bts:rnd (car p1) 3) xs)))
               ((bts:near (cadr p1) (cadr p2) 0.001)
                (setq ys (cons (bts:rnd (cadr p1) 3) ys)))
               (t (setq skew (1+ skew)))))
           (setq i (1+ i)))))
     (if (> skew 0)
       (setq out (cons (bts:iss "GRID" lay
                                (strcat (itoa skew) " grid line(s) are not axis aligned"))
                       out)))
     (setq xs (bts:sort (bts:uniq xs) '(lambda (a b) (< a b)))
           ys (bts:sort (bts:uniq ys) '(lambda (a b) (< a b))))
     (foreach s (list (cons "easting" xs) (cons "northing" ys))
       (setq step (bts:even-step (cdr s)))
       (cond
         ((< (length (cdr s)) 2)
          (setq out (cons (bts:iss "GRID" lay
                                   (strcat "fewer than two " (car s) " grid lines"))
                          out)))
         ((null step)
          (setq out (cons (bts:iss "GRID" lay
                                   (strcat (car s) " grid lines are not evenly spaced"))
                          out)))
         ((null (bts:member-step step))
          (setq out (cons (bts:iss "GRID" lay
                                   (strcat (car s) " grid spacing is " (rtos step 2 2)
                                           " m - not a standard interval"))
                          out)))))
     ;; Labels: the number in the string has to be one of the lines.
     (if (setq ss (ssget "_X" (list (cons 8 lay)
                                    '(-4 . "<OR") '(0 . "TEXT") '(0 . "MTEXT") '(-4 . "OR>"))))
       (progn
         (setq i 0)
         (repeat (sslength ss)
           (setq e   (entget (ssname ss i))
                 lab (bts:num-in-str (bts:no-space (bts:ent-text e))))
           (if (and lab
                    (null (bts:near-any lab xs *BTS-A-GRID-TOL*))
                    (null (bts:near-any lab ys *BTS-A-GRID-TOL*)))
             (setq out (cons (bts:iss "GRID" lay
                                      (strcat "label " (rtos lab 2 2)
                                              " does not sit on a grid line"))
                             out)))
           (setq i (1+ i)))))
     (reverse out))))

;;; All gaps equal, to a millimetre. Returns the spacing or nil.
(defun bts:even-step (lst / prev step d ok v)
  (setq ok T)
  (foreach v lst
    (if prev
      (progn
        (setq d (- v prev))
        (if (null step) (setq step d))
        (if (not (bts:near d step 0.001)) (setq ok nil))))
    (setq prev v))
  (if (and ok step (> step 0.0)) step))

(defun bts:member-step (step / x hit)
  (foreach x *BTS-A-GRID-STEPS* (if (bts:near step x 0.01) (setq hit T)))
  hit)

(defun bts:near-any (v lst tol / x hit)
  (foreach x lst (if (bts:near v x tol) (setq hit T)))
  hit)

;;; ------------------------------------------------------------------
;;;  Master engines
;;; ------------------------------------------------------------------

;;; Applies the whole register. Release R keeps this inline in C:BTSFIX;
;;; as a function the auto, clean and batch commands can call it and
;;; read the counts back. Returns (created . updated).
(defun bts:fix ( / spec nm made fixed)
  (setq made 0 fixed 0)
  (foreach spec *BTS-LAYERS*
    (setq nm (car spec))
    (if (bts:lay-ent nm)
      (progn (bts:update-layer nm) (setq fixed (1+ fixed)))
      (progn (bts:create-layer nm) (setq made (1+ made)))))
  (cons made fixed))

;;; Applies every approved remapping rule, splits first so a mixed
;;; legacy layer is not flattened onto one target. Returns
;;; (objects-moved . layers-purged).
(defun bts:remap-all ( / pair old new hlay moved gone r n)
  (setq moved 0 gone 0)
  (foreach pair *BTS-SPLIT*
    (setq old (car pair) new (cadr pair) hlay (caddr pair))
    (if (and (bts:lay-ent old) (bts:lay-ent new) (bts:lay-ent hlay))
      (progn
        (setq r (bts:split-layer old new hlay)
              moved (+ moved (car r) (cdr r)))
        (if (car (bts:delete-layer old)) (setq gone (1+ gone))))))
  (foreach pair *BTS-REMAP*
    (setq old (car pair) new (cdr pair))
    (if (and (null (bts:split-of old)) (bts:lay-ent old) (bts:lay-ent new))
      (progn
        (if (setq n (bts:remap-layer old new)) (setq moved (+ moved n)))
        (if (car (bts:delete-layer old)) (setq gone (1+ gone))))))
  (cons moved gone))

;;; Junk scan, protected purge and a regen. Returns
;;; ((kind . n) ...) with the junk count on the front.
(defun bts:cleanup ( / junk res)
  (setq junk (length (bts:check-junk))
        res  (bts:purge-safe))
  (command "_.REGENALL")
  (cons (cons "junk items" junk) res))

;;; Release R prints its housekeeping scan; this returns it, and adds
;;; the bound-xref block patterns the suite knows about.
(defun bts:check-junk ( / out rec nm)
  (setq out '() rec (tblnext "LAYER" T))
  (while rec
    (setq nm (cdr (assoc 2 rec)))
    (if (wcmatch nm "*`@*")
      (setq out (cons (bts:iss "JUNK" nm "bound xref layer") out)))
    (setq rec (tblnext "LAYER")))
  (setq rec (tblnext "BLOCK" T))
  (while rec
    (setq nm (cdr (assoc 2 rec)))
    (cond
      ((wcmatch nm "A`$C*") (setq out (cons (bts:iss "JUNK" nm "bound xref block") out)))
      ((wcmatch nm "TB `- *") (setq out (cons (bts:iss "JUNK" nm "legacy title block") out)))
      ((bts:wc-any nm *BTS-A-JUNK-BLOCKS*)
       (setq out (cons (bts:iss "JUNK" nm "template residue") out))))
    (setq rec (tblnext "BLOCK")))
  (setq rec (tblnext "STYLE" T))
  (while rec
    (setq nm (cdr (assoc 2 rec)))
    (if (wcmatch (strcase nm) "PDF *")
      (setq out (cons (bts:iss "JUNK" nm "PDF import text style") out)))
    (setq rec (tblnext "STYLE")))
  (reverse out))

;;; Characters AutoCAD reserves in a symbol name. Tested one at a time
;;; rather than with a wcmatch character class - the backtick is the
;;; wildcard escape and cannot be put inside brackets.
(defun bts:bad-name-p (nm / i c bad)
  (setq i 1)
  (while (<= i (strlen nm))
    (setq c (substr nm i 1))
    (if (member c '("<" ">" "/" "\\" "\"" ":" ";" "?" "*" "|" "," "=" "`"))
      (setq bad T))
    (setq i (1+ i)))
  bad)

;;; Database integrity, the part of an AUDIT that AutoCAD does not
;;; report on: proxies, unresolved references and name hygiene.
(defun bts:check-db ( / out n blk rec nm bad)
  (setq out '())
  (if (> (setq n (+ (bts:count-type "ACAD_PROXY_ENTITY")
                    (bts:count-type "ACAD_PROXY_OBJECT")))
         0)
    (setq out (cons (bts:iss "DB" "(drawing)"
                             (strcat (itoa n) " proxy object(s) from an application "
                                     "that is not installed"))
                    out)))
  (foreach blk (bts:get-blocks)
    (if (and (nth 1 blk) (nth 4 blk) (null (findfile (nth 4 blk))))
      (setq out (cons (bts:iss "DB" (nth 0 blk)
                               (strcat "unresolved xref: " (nth 4 blk)))
                      out))))
  (if (> (setq n (bts:appid-count)) 200)
    (setq out (cons (bts:iss "DB" "(regapps)"
                             (strcat (itoa n) " registered applications - PURGE Regapps"))
                    out)))
  (setq bad '())
  (foreach nm (bts:get-drawing-layers)
    (if (bts:bad-name-p nm) (setq bad (cons nm bad))))
  (foreach nm bad
    (setq out (cons (bts:iss "DB" nm "layer name contains a character AutoCAD reserves") out)))
  (if (/= 0 (getvar "DBMOD"))
    (setq out (cons (bts:iss "DB" "(drawing)" "unsaved changes in the drawing") out)))
  (reverse out))

;;; Every read-only check in the suite, in report order.
(defun bts:audit-full ( / out)
  (setq out (bts:audit))
  (setq out (append out (bts:check-units)))
  (setq out (append out (bts:check-db)))
  (setq out (append out (bts:check-junk)))
  (setq out (append out (bts:check-overrides)))
  (setq out (append out (bts:check-titleblock)))
  (setq out (append out (bts:check-layouts)))
  (setq out (append out (bts:check-viewports)))
  (setq out (append out (bts:check-plot)))
  (setq out (append out (bts:check-blocks)))
  (setq out (append out (bts:check-text)))
  (setq out (append out (bts:check-dims)))
  (setq out (append out (bts:check-leaders)))
  (setq out (append out (bts:check-utility)))
  (setq out (append out (bts:check-ltype)))
  (setq out (append out (bts:check-ql)))
  (setq out (append out (bts:check-bng)))
  (setq out (append out (bts:check-grid)))
  out)

;;; ------------------------------------------------------------------
;;;  Statistics
;;; ------------------------------------------------------------------

(defun bts:run-length (lay / r len s)
  (setq r (car (bts:segs-on-layer lay)) len 0.0)
  (foreach s r (setq len (+ len (distance (car s) (cadr s)))))
  len)

;;; Bulged polyline segments are measured as chords, which is close
;;; enough for a quantity check and honest about being an estimate.
(defun bts:stats ( / out ex svc n len census total p)
  (setq out '() census (bts:ent-census) total 0)
  (foreach p census (setq total (+ total (cdr p))))
  (setq out (list (cons "Drawing" (getvar "DWGNAME"))
                  (cons "Standard" (strcat *BTS-STD-VERSION* " / " *BTS-A-VERSION*))
                  (cons "Objects" (itoa total))
                  (cons "Layers" (itoa (bts:table-count "LAYER")))
                  (cons "BTS layers present"
                        (itoa (length (bts:present-std-layers))))
                  (cons "Blocks" (itoa (length (bts:get-blocks))))
                  (cons "Layouts" (itoa (length (bts:get-sheets))))
                  (cons "Viewports" (itoa (length (bts:all-vports))))
                  (cons "Text objects"
                        (itoa (+ (bts:count-type "TEXT") (bts:count-type "MTEXT"))))
                  (cons "Dimensions" (itoa (bts:count-type "DIMENSION")))
                  (cons "Hatches" (itoa (bts:count-type "HATCH")))))
  (if (setq ex (bts:extents))
    (setq out (append out
                      (list (cons "Extents"
                                  (strcat (rtos (car (car ex)) 2 2) ", "
                                          (rtos (cadr (car ex)) 2 2) "  to  "
                                          (rtos (car (cadr ex)) 2 2) ", "
                                          (rtos (cadr (cadr ex)) 2 2)))
                            (cons "Site size"
                                  (strcat (rtos (- (car (cadr ex)) (car (car ex))) 2 1)
                                          " x "
                                          (rtos (- (cadr (cadr ex)) (cadr (car ex))) 2 1)
                                          " m"))))))
  (foreach svc (bts:services)
    (setq n   (bts:count-on-wc (strcat "BTS-U-" svc "-Apparatus"))
          len (if (> n 0) (bts:run-length (strcat "BTS-U-" svc "-Apparatus")) 0.0))
    (if (> n 0)
      (setq out (append out
                        (list (cons (strcat "Utility " svc)
                                    (strcat (itoa n) " object(s), "
                                            (rtos len 2 1) " m of run")))))))
  out)

(defun bts:present-std-layers ( / spec out)
  (foreach spec *BTS-LAYERS*
    (if (bts:lay-ent (car spec)) (setq out (cons (car spec) out))))
  (reverse out))

;;; ------------------------------------------------------------------
;;;  Report writers
;;; ------------------------------------------------------------------

(defun bts:report-writer (fn title lines / f l)
  (if (setq f (bts:open-out fn))
    (progn
      (write-line (strcat "BTS " *BTS-A-VERSION*) f)
      (write-line title f)
      (write-line "==============================================================" f)
      (write-line (strcat "Drawing  : " (getvar "DWGNAME")) f)
      (write-line (strcat "Folder   : " (getvar "DWGPREFIX")) f)
      (write-line (strcat "Written  : " (bts:stamp)) f)
      (write-line (strcat "Register : " *BTS-STD-VERSION*) f)
      (write-line "" f)
      (foreach l lines (write-line l f))
      (close f)
      fn)))

(defun bts:report-issues (fn title iss / lines i codes p)
  (setq lines '() codes '())
  (foreach i iss (setq codes (bts:tally (bts:iss-code i) codes)))
  (setq lines (list (strcat (itoa (length iss)) " item(s) reported") ""))
  (foreach p (bts:sort-count codes)
    (setq lines (append lines (list (strcat "  " (bts:pad (car p) 12) (itoa (cdr p)))))))
  (setq lines (append lines
                      (list "" (strcat (bts:pad "CODE" 10) (bts:pad "ITEM" 32) "DETAIL"))))
  (setq lines (append lines (mapcar 'bts:iss-line iss)))
  (bts:report-writer fn title lines))

(defun bts:csv-writer (fn rows / f r)
  (if (setq f (bts:open-out fn))
    (progn
      (foreach r rows (write-line (bts:csv-row r) f))
      (close f)
      fn)))

(defun bts:csv-append (fn rows / f r new)
  (setq new (null (findfile fn)))
  (if (setq f (open fn "a"))
    (progn
      (if new (write-line (bts:csv-row (bts:csv-header)) f))
      (foreach r rows (write-line (bts:csv-row r) f))
      (close f)
      fn)
    (progn (bts:say (strcat "Could not append to " fn)) nil)))

(defun bts:csv-header ()
  '("SECTION" "KEY" "F1" "F2" "F3" "F4" "F5" "F6"))

;;; One CSV shape for the whole suite: a section column, a key, then up
;;; to six fields. It opens in a spreadsheet and BTSCOMPARE can read it
;;; back without a second format.
(defun bts:snapshot-rows (iss / rows spec nm e v p)
  (setq rows (list (bts:csv-header)
                   (list "DRAWING" (getvar "DWGNAME") (getvar "DWGPREFIX")
                         (bts:stamp) *BTS-A-VERSION*
                         *BTS-STD-VERSION* "" "")))
  (foreach nm (bts:get-drawing-layers)
    (if (setq e (bts:lay-ent nm))
      (progn
        (setq e (entget e))
        (setq rows (append rows
                           (list (list "LAYER" nm
                                       (abs (cond ((cdr (assoc 62 e))) (t 7)))
                                       (cond ((cdr (assoc 6 e))) (t "Continuous"))
                                       (cond ((cdr (assoc 370 e))) (t -3))
                                       (cond ((cdr (assoc 290 e))) (t 1))
                                       (bts:trans-pct nm)
                                       (bts:count-on-layer nm))))))))
  (foreach v *BTS-VARS*
    (setq p (vl-catch-all-apply 'getvar (list (car v))))
    (if (not (vl-catch-all-error-p p))
      (setq rows (append rows (list (list "VAR" (car v) (vl-princ-to-string p)
                                          (vl-princ-to-string (cadr v)) "" "" "" ""))))))
  (foreach p (bts:stats)
    (setq rows (append rows (list (list "STAT" (car p) (cdr p) "" "" "" "" "")))))
  (foreach p iss
    (setq rows (append rows (list (list "ISSUE" (bts:iss-code p) (bts:iss-item p)
                                        (bts:iss-detail p) "" "" "" "")))))
  rows)

;;; ---- JSON ----

(defun bts:json-esc (s)
  (bts:str-rep (bts:str-rep (bts:str-rep s "\\" "\\\\") "\"" "\\\"") "\n" "\\n"))

;;; Values are strings, numbers, (OBJ (key . value) ...) or
;;; (ARR value ...). Nothing else has to survive the trip.
(defun bts:json-val (v ind / out n i x)
  (cond
    ((null v) "null")
    ((= (type v) 'STR) (strcat "\"" (bts:json-esc v) "\""))
    ((= (type v) 'INT) (itoa v))
    ((= (type v) 'REAL) (rtos v 2 4))
    ((and (listp v) (eq (car v) 'OBJ))
     (setq out "{" n (length (cdr v)) i 0)
     (foreach x (cdr v)
       (setq i (1+ i)
             out (strcat out "\n" ind "  \"" (bts:json-esc (car x)) "\": "
                         (bts:json-val (cdr x) (strcat ind "  "))
                         (if (< i n) "," ""))))
     (strcat out "\n" ind "}"))
    ((and (listp v) (eq (car v) 'ARR))
     (setq out "[" n (length (cdr v)) i 0)
     (foreach x (cdr v)
       (setq i (1+ i)
             out (strcat out "\n" ind "  "
                         (bts:json-val x (strcat ind "  "))
                         (if (< i n) "," ""))))
     (strcat out "\n" ind "]"))
    (t (strcat "\"" (bts:json-esc (vl-princ-to-string v)) "\""))))

(defun bts:json-writer (fn sections / f n i s)
  (if (setq f (bts:open-out fn))
    (progn
      (write-line "{" f)
      (setq n (length sections) i 0)
      (foreach s sections
        (setq i (1+ i))
        (write-line (strcat "  \"" (bts:json-esc (car s)) "\": "
                            (bts:json-val (cdr s) "  ")
                            (if (< i n) "," ""))
                    f))
      (write-line "}" f)
      (close f)
      fn)))

(defun bts:json-sections (iss / lays vars stats nm e p)
  (setq lays (list 'ARR) vars (list 'ARR) stats (list 'OBJ))
  (foreach nm (bts:get-drawing-layers)
    (if (setq e (bts:lay-ent nm))
      (progn
        (setq e (entget e))
        (setq lays (append lays
                           (list (list 'OBJ
                                       (cons "name" nm)
                                       (cons "colour" (abs (cond ((cdr (assoc 62 e))) (t 7))))
                                       (cons "linetype" (cond ((cdr (assoc 6 e))) (t "Continuous")))
                                       (cons "lineweight" (cond ((cdr (assoc 370 e))) (t -3)))
                                       (cons "plot" (cond ((cdr (assoc 290 e))) (t 1)))
                                       (cons "transparency" (bts:trans-pct nm))
                                       (cons "objects" (bts:count-on-layer nm))
                                       (cons "inStandard" (if (bts:lay-in-standard nm) "yes" "no")))))))))
  (foreach p *BTS-VARS*
    (setq e (vl-catch-all-apply 'getvar (list (car p))))
    (if (not (vl-catch-all-error-p e))
      (setq vars (append vars
                         (list (list 'OBJ
                                     (cons "name" (car p))
                                     (cons "value" (vl-princ-to-string e))
                                     (cons "required" (vl-princ-to-string (cadr p)))))))))
  (foreach p (bts:stats) (setq stats (append stats (list (cons (car p) (cdr p))))))
  (list
    (cons "suite" *BTS-A-VERSION*)
    (cons "register" *BTS-STD-VERSION*)
    (cons "drawing" (getvar "DWGNAME"))
    (cons "folder" (getvar "DWGPREFIX"))
    (cons "written" (bts:stamp))
    (cons "statistics" stats)
    (cons "layers" lays)
    (cons "variables" vars)
    (cons "issues"
          (append (list 'ARR)
                  (mapcar '(lambda (i)
                             (list 'OBJ
                                   (cons "code" (bts:iss-code i))
                                   (cons "item" (bts:iss-item i))
                                   (cons "detail" (bts:iss-detail i))))
                          iss)))))

;;; ------------------------------------------------------------------
;;;  Batch and project work
;;;
;;;  LT has no ObjectDBX, so no drawing but the open one can be read
;;;  from inside AutoCAD. The batch commands therefore write a script
;;;  for SCRIPT to run, and each drawing appends its own findings to a
;;;  shared CSV log that the project commands read back.
;;; ------------------------------------------------------------------

(defun bts:fwd (p) (bts:str-rep p "\\" "/"))

;;; Every .dwg under DIR. RECURSE walks subfolders as well.
(defun bts:batch-folder-scan (dir recurse / files subs out d f)
  (setq dir (bts:end-slash dir) out '())
  (foreach f (vl-directory-files dir "*.dwg" 1)
    (setq out (cons (strcat dir f) out)))
  (if recurse
    (foreach d (vl-directory-files dir nil -1)
      (if (not (member d '("." "..")))
        (setq out (append out (bts:batch-folder-scan (strcat dir d) T))))))
  (bts:sort-alpha out))

(defun bts:module-path (nm / p)
  (if (setq p (findfile nm)) (bts:fwd p) nil))

;;; Builds the script. CALLS is the LISP to run in each drawing.
(defun bts:write-script (scr files calls save / f me n dwg)
  (setq me (bts:module-path "BTS-Approver-Standards-D-RevA.lsp")
        n  0)
  (if (null me) (setq me "BTS-Approver-Standards-D-RevA"))
  (if (setq f (bts:open-out scr))
    (progn
      (write-line "; BTS batch script - run it from a blank drawing with SCRIPT." f)
      (write-line (strcat "; Written " (bts:stamp) " by BTS " *BTS-A-VERSION*) f)
      (write-line "(setvar \"FILEDIA\" 0)(setvar \"CMDECHO\" 0)" f)
      (foreach dwg files
        (write-line (strcat "_.OPEN \"" (bts:fwd dwg) "\"") f)
        (write-line (strcat "(load \"" me "\")") f)
        (write-line "(setq *BTS-A-BATCH* T)" f)
        (write-line calls f)
        (if save (write-line "_.QSAVE" f))
        (write-line "_.CLOSE" f)
        (setq n (1+ n)))
      (write-line "(setvar \"FILEDIA\" 1)(setvar \"CMDECHO\" 1)" f)
      (write-line (strcat "(princ \"\\nBTS batch finished - " (itoa n) " drawing(s).\")") f)
      (close f)
      scr)))

;;; Called inside each batch drawing: audit, append to the shared log.
(defun bts:project-log (logfile / iss rows p)
  (setq iss (bts:audit-full)
        rows (list (list "DRAWING" (getvar "DWGNAME") (getvar "DWGPREFIX")
                         (bts:stamp) (itoa (length iss))
                         (itoa (bts:table-count "LAYER")) *BTS-A-VERSION* "")))
  (foreach p iss
    (setq rows (append rows (list (list "ISSUE" (getvar "DWGNAME") (bts:iss-code p)
                                        (bts:iss-item p) (bts:iss-detail p) "" "" "")))))
  (bts:csv-append logfile rows)
  (length iss))

(defun bts:pick-folder (prompt / p)
  (if (setq p (getfiled prompt (bts:dwg-dir) "dwg" 0))
    (bts:end-slash (vl-filename-directory p))))

;;; ---- comparison ----

(defun bts:snap-read (fn / rows out r)
  (foreach r (bts:csv-read fn)
    (if (member (strcase (bts:fld r 0)) '("LAYER" "VAR" "DRAWING"))
      (setq out (cons r out))))
  (reverse out))

(defun bts:snap-layers (rows / out r)
  (foreach r rows
    (if (= (strcase (bts:fld r 0)) "LAYER")
      (setq out (cons (cons (bts:fld r 1)
                            (list (bts:fld r 2) (bts:fld r 3) (bts:fld r 4)
                                  (bts:fld r 5) (bts:fld r 6)))
                      out))))
  (reverse out))

(defun bts:snap-vars (rows / out r)
  (foreach r rows
    (if (= (strcase (bts:fld r 0)) "VAR")
      (setq out (cons (cons (bts:fld r 1) (bts:fld r 2)) out))))
  (reverse out))

;;; The current drawing in the same shape as a snapshot, so one
;;; comparison routine covers file against file and file against here.
(defun bts:live-layers ( / out nm e)
  (foreach nm (bts:get-drawing-layers)
    (if (setq e (bts:lay-ent nm))
      (progn
        (setq e (entget e))
        (setq out (cons (cons nm
                              (list (itoa (abs (cond ((cdr (assoc 62 e))) (t 7))))
                                    (cond ((cdr (assoc 6 e))) (t "Continuous"))
                                    (itoa (cond ((cdr (assoc 370 e))) (t -3)))
                                    (itoa (cond ((cdr (assoc 290 e))) (t 1)))
                                    (itoa (bts:trans-pct nm))))
                        out)))))
  (reverse out))

(defun bts:live-vars ( / out v p)
  (foreach v *BTS-VARS*
    (setq p (vl-catch-all-apply 'getvar (list (car v))))
    (if (not (vl-catch-all-error-p p))
      (setq out (cons (cons (car v) (vl-princ-to-string p)) out))))
  (reverse out))

(defun bts:compare (an alays avars bn blays bvars / out p q i fields fl)
  (setq out '() fields '("colour" "linetype" "lineweight" "plot" "transparency"))
  (foreach p alays
    (if (null (bts:assoc-ci (car p) blays))
      (setq out (cons (bts:iss "ONLY-A" (car p) (strcat "layer only in " an)) out))))
  (foreach p blays
    (if (null (bts:assoc-ci (car p) alays))
      (setq out (cons (bts:iss "ONLY-B" (car p) (strcat "layer only in " bn)) out))))
  (foreach p alays
    (if (setq q (bts:assoc-ci (car p) blays))
      (progn
        (setq i 0)
        (foreach fl fields
          (if (/= (strcase (nth i (cdr p))) (strcase (nth i (cdr q))))
            (setq out (cons (bts:iss "DIFF" (car p)
                                     (strcat fl ": " an " " (nth i (cdr p))
                                             " / " bn " " (nth i (cdr q))))
                            out)))
          (setq i (1+ i))))))
  (foreach p avars
    (if (setq q (bts:assoc-ci (car p) bvars))
      (if (/= (strcase (cdr p)) (strcase (cdr q)))
        (setq out (cons (bts:iss "VAR" (car p)
                                 (strcat an " " (cdr p) " / " bn " " (cdr q)))
                        out)))))
  (reverse out))

;;; ==================================================================
;;;  COMMANDS - advanced
;;; ==================================================================

;;; ---- BTSLAYERS : rebuild the entire BTS layer register ----
;;; Stronger than BTSFIX: as well as creating and correcting, it thaws,
;;; turns on and unlocks every standard layer, loads any linetype the
;;; register needs, and reports what it could not do.
(defun C:BTSLAYERS (/ *error* spec nm r made fixed missing ce)
  (defun *error* (m)
    (if *pop-error-mode* (*pop-error-mode*))
    (if ce (setvar "CMDECHO" ce))
    (princ (strcat "\nBTSLAYERS stopped on layer: " (if nm nm "(none)") "\n  " m))
    (princ))
  (setq ce (getvar "CMDECHO") made 0 fixed 0 missing '())
  (setvar "CMDECHO" 0)
  (bts:head "BTSLAYERS - rebuilding the layer register")
  (foreach spec *BTS-LAYERS*
    (setq nm (car spec))
    (if (bts:lay-ent nm)
      (progn (bts:update-layer nm) (bts:unlock-layer nm) (setq fixed (1+ fixed)))
      (progn
        (if (bts:create-layer nm)
          (setq made (1+ made))
          (setq missing (cons nm missing)))))
    (princ "."))
  (setq nm nil)
  (if (null (bts:lay-ent (getvar "CLAYER"))) (setvar "CLAYER" "BTS-S-BMap"))
  (if (= (strcase (getvar "CLAYER")) "0") (setvar "CLAYER" "BTS-S-BMap"))
  (setvar "CMDECHO" ce)
  (bts:rule)
  (bts:say (strcat "  " (itoa made) " layer(s) created, " (itoa fixed) " rebuilt."))
  (if missing
    (progn
      (bts:say (strcat "  " (itoa (length missing)) " layer(s) could not be created:"))
      (foreach nm missing (bts:say (strcat "     " nm)))))
  (bts:say "  BTSCHECK confirms, BTSREMAP clears the legacy layers.")
  (princ))

;;; ---- BTSCLEAN : check, fix, variables, purge ----
(defun C:BTSCLEAN ()
  (bts:head "BTSCLEAN - full standards pass")
  (C:BTSCHECK)
  (C:BTSFIX)
  (C:BTSVARS)
  (C:BTSPURGE)
  (bts:rule)
  (bts:say "  BTSCLEAN finished. Re-run BTSCHECK to confirm.")
  (princ))

;;; ---- BTSAUDIT : database integrity ----
(defun C:BTSAUDIT (/ *error* ce iss ans i)
  (defun *error* (m)
    (if *pop-error-mode* (*pop-error-mode*))
    (if ce (setvar "CMDECHO" ce))
    (princ (strcat "\nBTSAUDIT stopped.\n  " m))
    (princ))
  (setq ce (getvar "CMDECHO"))
  (setvar "CMDECHO" 1)
  (bts:head "BTSAUDIT - database integrity")
  (bts:say "  Running AUDIT in report-only mode ...")
  (if *push-error-using-command* (*push-error-using-command*))
  (command "_.AUDIT" "_N")
  (if *pop-error-mode* (*pop-error-mode*))
  (setvar "CMDECHO" ce)
  (setq iss (bts:check-db))
  (bts:rule)
  (if (null iss)
    (bts:say "  No database problems found beyond AUDIT's own report.")
    (foreach i iss (bts:say (bts:iss-line i))))
  (bts:rule)
  (bts:say (strcat "  " (itoa (length iss)) " item(s). BTSRECOVER repairs what AUDIT can fix."))
  (princ))

;;; ---- BTSRECOVER : database recovery workflow ----
;;; RECOVER itself only works on a closed file, so what can be done from
;;; inside is a backup, a fixing AUDIT and a protected purge. If that
;;; does not settle the drawing the last step is the one to follow.
(defun C:BTSRECOVER (/ *error* ce src bak ans res p)
  (defun *error* (m)
    (if *pop-error-mode* (*pop-error-mode*))
    (if ce (setvar "CMDECHO" ce))
    (princ (strcat "\nBTSRECOVER stopped.\n  " m))
    (princ))
  (bts:head "BTSRECOVER - recovery workflow")
  (setq src (strcat (getvar "DWGPREFIX") (getvar "DWGNAME")))
  (cond
    ((= 0 (getvar "DWGTITLED"))
     (bts:say "  Drawing has never been saved. Save it first, then re-run."))
    (t
     (setq ans (bts:ask "AUDIT will change the database. Continue?" "No"))
     (if (/= ans "Yes")
       (bts:say "  Cancelled - nothing changed.")
       (progn
         (setq bak (strcat (getvar "DWGPREFIX")
                           (vl-filename-base (getvar "DWGNAME"))
                           "_BTSbackup_" (bts:datestamp) ".dwg"))
         (if (findfile src)
           (if (vl-file-copy src bak)
             (bts:say (strcat "  Backup written: " bak))
             (bts:say "  Backup could not be written - the last save is still on disk."))
           (bts:say "  Drawing has unsaved changes; the backup is of the last save."))
         (setq ce (getvar "CMDECHO"))
         (setvar "CMDECHO" 1)
         (if *push-error-using-command* (*push-error-using-command*))
         (command "_.AUDIT" "_Y")
         (if *pop-error-mode* (*pop-error-mode*))
         (setvar "CMDECHO" ce)
         (setq res (bts:purge-safe))
         (bts:rule)
         (foreach p res
           (bts:say (strcat "  purged " (bts:pad (car p) 14) (itoa (cdr p)))))
         (bts:rule)
         (bts:say "  Now SAVEAS to a new file name and reopen it.")
         (bts:say "  If the drawing still misbehaves, close it and run RECOVER")
         (bts:say "  on the file from a blank session - that rebuilds what AUDIT cannot.")))))
  (princ))

;;; ---- BTSPURGE : protected purge ----
(defun C:BTSPURGE (/ *error* ce res p)
  (defun *error* (m)
    (if *pop-error-mode* (*pop-error-mode*))
    (if ce (setvar "CMDECHO" ce))
    (princ (strcat "\nBTSPURGE stopped.\n  " m))
    (princ))
  (setq ce (getvar "CMDECHO"))
  (setvar "CMDECHO" 0)
  (bts:head "BTSPURGE - protected purge")
  (if *push-error-using-command* (*push-error-using-command*))
  (setq res (bts:purge-safe))
  (if *pop-error-mode* (*pop-error-mode*))
  (setvar "CMDECHO" ce)
  (foreach p res
    (bts:say (strcat "  " (bts:pad (car p) 14) (itoa (cdr p)) " removed")))
  (bts:rule)
  (bts:say "  Standard layers, title blocks and the keep lists were held back.")
  (princ))

;;; ---- BTSPLOTCHECK : plot readiness ----
(defun C:BTSPLOTCHECK ()
  (bts:show "BTSPLOTCHECK - plot readiness" (bts:check-plot))
  (princ))

;;; ---- BTSTITLECHECK : title block metadata ----
(defun C:BTSTITLECHECK ()
  (bts:show "BTSTITLECHECK - title block metadata" (bts:check-titleblock))
  (bts:say "  Tag patterns come from *BTS-A-TITLE-ATTS* - edit it to match your block.")
  (princ))

;;; ---- BTSDWGINFO : drawing metadata ----
(defun C:BTSDWGINFO (/ ex p)
  (bts:head "BTSDWGINFO - drawing metadata")
  (foreach p (list
               (cons "File" (strcat (getvar "DWGPREFIX") (getvar "DWGNAME")))
               (cons "Saved" (if (= 1 (getvar "DWGTITLED")) "yes" "never saved"))
               (cons "Modified" (if (= 0 (getvar "DBMOD")) "no" "unsaved changes"))
               (cons "Created" (bts:jdate "TDCREATE"))
               (cons "Last updated" (bts:jdate "TDUPDATE"))
               (cons "Editing time" (strcat (rtos (* 24.0 (getvar "TDINDWG")) 2 2) " hours"))
               (cons "Last saved by" (getvar "LOGINNAME"))
               (cons "Format" (getvar "ACADVER"))
               (cons "Units" (strcat "INSUNITS " (itoa (getvar "INSUNITS"))
                                     ", LUPREC " (itoa (getvar "LUPREC"))))
               (cons "Current layer" (getvar "CLAYER"))
               (cons "Current style" (getvar "TEXTSTYLE"))
               (cons "Layers" (itoa (bts:table-count "LAYER")))
               (cons "Blocks" (itoa (length (bts:get-blocks))))
               (cons "Sheets" (itoa (length (bts:get-sheets))))
               (cons "Viewports" (itoa (length (bts:all-vports)))))
    (bts:say (strcat "  " (bts:pad (car p) 16) (cdr p))))
  (if (setq ex (bts:extents))
    (bts:say (strcat "  " (bts:pad "Extents" 16)
                     (rtos (car (car ex)) 2 2) ", " (rtos (cadr (car ex)) 2 2)
                     "  to  " (rtos (car (cadr ex)) 2 2) ", " (rtos (cadr (cadr ex)) 2 2))))
  (bts:rule)
  (foreach p (bts:sort-count (bts:ent-census))
    (bts:say (strcat "  " (bts:pad (car p) 24) (itoa (cdr p)))))
  (bts:rule)
  (princ))

;;; ---- BTSUNITS : units verification and correction ----
(defun C:BTSUNITS (/ iss v ans n)
  (setq iss (bts:check-units))
  (bts:show "BTSUNITS - units verification" iss)
  (if iss
    (progn
      (setq ans (bts:ask "Set the units variables now?" "No"))
      (if (= ans "Yes")
        (progn
          (setq n 0)
          (foreach v *BTS-A-UNITS*
            (if (not (vl-catch-all-error-p
                       (vl-catch-all-apply 'setvar (list (nth 0 v) (nth 1 v)))))
              (setq n (1+ n))))
          (bts:say (strcat "  " (itoa n) " variable(s) set. Re-run BTSUNITS to confirm."))))))
  (princ))

;;; ==================================================================
;;;  COMMANDS - CAD manager
;;; ==================================================================

(defun C:BTSEXPORTCSV (/ fn)
  (setq fn (bts:out-file "_BTSAudit" ".csv"))
  (if (bts:csv-writer fn (bts:snapshot-rows (bts:audit-full)))
    (bts:say (strcat "CSV written: " fn)))
  (princ))

(defun C:BTSEXPORTJSON (/ fn)
  (setq fn (bts:out-file "_BTSAudit" ".json"))
  (if (bts:json-writer fn (bts:json-sections (bts:audit-full)))
    (bts:say (strcat "JSON written: " fn)))
  (princ))

(defun C:BTSSTATS (/ p)
  (bts:head "BTSSTATS - project statistics")
  (foreach p (bts:stats)
    (bts:say (strcat "  " (bts:pad (car p) 22) (cdr p))))
  (bts:rule)
  (bts:show-census "Objects by type" (bts:ent-census) "object(s)")
  (bts:rule)
  (princ))

(defun C:BTSBATCHCHECK (/ dir files scr log ans)
  (bts:head "BTSBATCHCHECK - audit a folder of drawings")
  (if (null (setq dir (bts:pick-folder "Pick any drawing in the folder to audit")))
    (bts:say "  Cancelled.")
    (progn
      (setq files (bts:batch-folder-scan dir (= "Yes" (bts:ask "Include subfolders?" "No")))
            log   (strcat dir *BTS-A-LOGNAME*)
            scr   (strcat dir "BTS-BatchCheck.scr"))
      (if (null files)
        (bts:say (strcat "  No drawings found in " dir))
        (progn
          (bts:write-script scr files
                            (strcat "(bts:project-log \"" (bts:fwd log) "\")")
                            nil)
          (bts:say (strcat "  " (itoa (length files)) " drawing(s) found."))
          (bts:say (strcat "  Script : " scr))
          (bts:say (strcat "  Log    : " log))
          (bts:rule)
          (bts:say "  Close this drawing, then run SCRIPT on the file above.")
          (bts:say "  BTSPROJECTREPORT reads the log when it has finished.")))))
  (princ))

(defun C:BTSBATCHFIX (/ dir files scr log ans)
  (bts:head "BTSBATCHFIX - repair a folder of drawings")
  (bts:say "  Every drawing is opened, corrected and SAVED. Work on copies.")
  (if (/= "Yes" (bts:ask "Build the batch repair script?" "No"))
    (bts:say "  Cancelled.")
    (if (null (setq dir (bts:pick-folder "Pick any drawing in the folder to repair")))
      (bts:say "  Cancelled.")
      (progn
        (setq files (bts:batch-folder-scan dir (= "Yes" (bts:ask "Include subfolders?" "No")))
              log   (strcat dir *BTS-A-LOGNAME*)
              scr   (strcat dir "BTS-BatchFix.scr"))
        (if (null files)
          (bts:say (strcat "  No drawings found in " dir))
          (progn
            (bts:write-script scr files
                              (strcat "(C:BTSAUTOFIX)(C:BTSAUTOREMAP)"
                                      "(bts:project-log \"" (bts:fwd log) "\")")
                              T)
            (bts:say (strcat "  " (itoa (length files)) " drawing(s) found."))
            (bts:say (strcat "  Script : " scr))
            (bts:say (strcat "  Log    : " log))
            (bts:rule)
            (bts:say "  Close this drawing, then run SCRIPT on the file above."))))))
  (princ))

(defun C:BTSCOMPARE (/ fa fb ra rb an bn iss i)
  (bts:head "BTSCOMPARE - standards differences")
  (bts:say "  Compares a BTSEXPORTCSV snapshot with this drawing, or with a second snapshot.")
  (if (null (setq fa (getfiled "Select the first BTS audit CSV" (bts:dwg-dir) "csv" 0)))
    (bts:say "  Cancelled.")
    (progn
      (setq ra (bts:snap-read fa)
            an (vl-filename-base fa))
      (if (null ra)
        (bts:say "  That file holds no BTS snapshot rows.")
        (progn
          (if (= "Yes" (bts:ask "Compare against a second CSV instead of this drawing?" "No"))
            (setq fb (getfiled "Select the second BTS audit CSV" (bts:dwg-dir) "csv" 0)))
          (if fb
            (setq rb (bts:snap-read fb) bn (vl-filename-base fb))
            (setq rb nil bn (getvar "DWGNAME")))
          (setq iss (bts:compare an (bts:snap-layers ra) (bts:snap-vars ra)
                                 bn
                                 (if rb (bts:snap-layers rb) (bts:live-layers))
                                 (if rb (bts:snap-vars rb) (bts:live-vars))))
          (bts:rule)
          (if (null iss)
            (bts:say "  No differences.")
            (foreach i iss (bts:say (bts:iss-line i))))
          (bts:rule)
          (bts:say (strcat "  " (itoa (length iss)) " difference(s) between "
                           an " and " bn "."))))))
  (princ))

;;; ==================================================================
;;;  COMMANDS - utility survey
;;; ==================================================================

(defun C:BTSUTILCHECK (/ svc n)
  (bts:show "BTSUTILCHECK - utility layer compliance" (bts:check-utility))
  (bts:say "  Objects on the apparatus layers:")
  (foreach svc (bts:services)
    (setq n (bts:count-on-wc (strcat "BTS-U-" svc "-Apparatus")))
    (if (> n 0)
      (bts:say (strcat "     " (bts:pad svc 10) (itoa n) " object(s)"))))
  (princ))

(defun C:BTSLTYPECHECK (/ iss)
  (setq iss (bts:check-ltype))
  (bts:show "BTSLTYPECHECK - utility linetypes" iss)
  (bts:show-census "Linetypes in use on utility layers" *BTS-A-LAST-LTYPES* "object(s)")
  (bts:say "  A linetype override on a utility run is the standard, not a fault.")
  (princ))

(defun C:BTSQLCHECK (/ iss)
  (setq iss (bts:check-ql))
  (bts:show "BTSQLCHECK - PAS 128 quality level attribution" iss)
  (bts:show-census "Quality levels found" *BTS-A-LAST-QL* "label(s)")
  (princ))

(defun C:BTSCONFLICTS ()
  (bts:show "BTSCONFLICTS - utility clashes and overlaps" (bts:check-conflicts))
  (bts:say (strcat "  Crossings, plus runs closer than "
                   (rtos *BTS-A-CLEARANCE* 2 2)
                   " m - *BTS-A-CLEARANCE*."))
  (bts:say "  Apparatus layers only. A crossing is not a clash until it is levelled.")
  (princ))

;;; ==================================================================
;;;  COMMANDS - GIS
;;; ==================================================================

(defun C:BTSBNGCHECK ()
  (bts:show "BTSBNGCHECK - British National Grid" (bts:check-bng))
  (princ))

(defun C:BTSGRIDCHECK ()
  (bts:show "BTSGRIDCHECK - grid consistency" (bts:check-grid))
  (princ))

(defun C:BTSCOORDS (/ ex cx cy sq p)
  (bts:head "BTSCOORDS - coordinate information")
  (bts:say (strcat "  " (bts:pad "Units" 16) "INSUNITS " (itoa (getvar "INSUNITS"))
                   (if (= 6 (getvar "INSUNITS")) " (metres)" " - not metres")))
  (bts:say (strcat "  " (bts:pad "UCS" 16)
                   (if (and (equal (getvar "UCSORG") '(0.0 0.0 0.0) 1e-8)
                            (equal (getvar "UCSXDIR") '(1.0 0.0 0.0) 1e-8))
                     "World"
                     "not World - coordinates will read wrong")))
  (if (null (setq ex (bts:extents)))
    (bts:say "  No geometry to report on.")
    (progn
      (setq cx (/ (+ (car (car ex)) (car (cadr ex))) 2.0)
            cy (/ (+ (cadr (car ex)) (cadr (cadr ex))) 2.0)
            sq (bts:bng-square cx cy))
      (bts:say (strcat "  " (bts:pad "Extents min" 16)
                       "E " (rtos (car (car ex)) 2 3) "   N " (rtos (cadr (car ex)) 2 3)))
      (bts:say (strcat "  " (bts:pad "Extents max" 16)
                       "E " (rtos (car (cadr ex)) 2 3) "   N " (rtos (cadr (cadr ex)) 2 3)))
      (bts:say (strcat "  " (bts:pad "Centre" 16)
                       "E " (rtos cx 2 3) "   N " (rtos cy 2 3)))
      (bts:say (strcat "  " (bts:pad "Site size" 16)
                       (rtos (- (car (cadr ex)) (car (car ex))) 2 1) " x "
                       (rtos (- (cadr (cadr ex)) (cadr (car ex))) 2 1) " m"))
      (bts:say (strcat "  " (bts:pad "Grid square" 16)
                       (cond (sq (strcat sq "  (" sq " "
                                         (rtos (rem cx 100000.0) 2 0) " "
                                         (rtos (rem cy 100000.0) 2 0) ")"))
                             (t "not on the National Grid"))))))
  (bts:rule)
  (if (and (null *BTS-A-BATCH*)
           (setq p (getpoint "\nPick a point for its grid reference, or ENTER to finish: ")))
    (progn
      (setq sq (bts:bng-square (car p) (cadr p)))
      (bts:say (strcat "  E " (rtos (car p) 2 3) "   N " (rtos (cadr p) 2 3)
                       "   " (cond (sq) (t "off grid"))))))
  (princ))

;;; ==================================================================
;;;  COMMANDS - sheets
;;; ==================================================================

(defun C:BTSSHEETCHECK ()
  (bts:show "BTSSHEETCHECK - sheet audit" (bts:check-sheets))
  (princ))

(defun C:BTSLAYOUTCHECK (/ l e)
  (bts:show "BTSLAYOUTCHECK - layout validation" (bts:check-layouts))
  (foreach l (bts:get-sheets)
    (setq e (entget (cadr l)))
    (bts:say (strcat "  " (bts:pad (car l) 24)
                     (bts:pad (cond ((bts:plot-get e 4)) (t "no paper size")) 22)
                     (bts:pad (cond ((bts:plot-get e 2)) (t "no plotter")) 24)
                     (itoa (length (bts:vports (car l)))) " vp")))
  (princ))

(defun C:BTSVIEWPORTS (/ l vp d n)
  (bts:head "BTSVIEWPORTS - viewport audit")
  (bts:say (strcat "  " (bts:pad "SHEET" 20) (bts:pad "SCALE" 12)
                   (bts:pad "LAYER" 22) (bts:pad "STATE" 18) "VP-FROZEN"))
  (setq n 0)
  (foreach l (bts:get-sheets)
    (foreach vp (bts:vports (car l))
      (setq d (bts:scan-viewport vp) n (1+ n))
      (bts:say (strcat "  " (bts:pad (car l) 20)
                       (bts:pad (bts:scale-str (bts:vp-get d "scale")) 12)
                       (bts:pad (bts:vp-get d "layer") 22)
                       (bts:pad (strcat (if (bts:vp-get d "on") "on" "OFF") "/"
                                        (if (bts:vp-get d "locked") "locked" "UNLOCKED")
                                        (if (bts:vp-get d "clipped") "/clipped" ""))
                                18)
                       (itoa (length (bts:vp-get d "frozen")))))))
  (bts:rule)
  (bts:say (strcat "  " (itoa n) " viewport(s)."))
  (bts:show "BTSVIEWPORTS - findings" (bts:check-viewports))
  (princ))

;;; ---- BTSVPLOCK : lock every viewport ----
(defun C:BTSVPLOCK (/ vp n tot)
  (setq n 0 tot 0)
  (foreach vp (bts:all-vports)
    (setq tot (1+ tot))
    (if (bts:vp-lock vp T) (setq n (1+ n))))
  (bts:head "BTSVPLOCK - lock all viewports")
  (bts:say (strcat "  " (itoa n) " of " (itoa tot) " viewport(s) locked."))
  (if (> tot 0)
    (bts:say "  Unlock one from Properties if a view still needs setting up."))
  (princ))

;;; ---- BTSVPFREEZE : viewport freeze management ----
(defun C:BTSVPFREEZE (/ opt lay l vp d n fz)
  (initget "Report Freeze Thaw Standard")
  (setq opt (cond ((getkword "\nViewport freeze [Report/Freeze/Thaw/Standard] <Report>: "))
                  (t "Report")))
  (cond
    ((= opt "Report")
     (bts:head "BTSVPFREEZE - frozen layers by viewport")
     (foreach l (bts:get-sheets)
       (foreach vp (bts:vports (car l))
         (setq d (bts:scan-viewport vp))
         (bts:say (strcat "  " (bts:pad (strcat (car l) " vp"
                                                (itoa (bts:vp-get d "id"))) 26)
                          (itoa (length (bts:vp-get d "frozen"))) " frozen"))
         (foreach fz (bts:vp-get d "frozen")
           (bts:say (strcat "        " fz)))))
     (bts:rule))
    ((= opt "Standard")
     (setq n 0)
     (foreach fz *BTS-A-VPFREEZE*
       (if (bts:lay-ent fz)
         (foreach vp (bts:all-vports)
           (if (bts:vp-freeze vp fz T) (setq n (1+ n))))
         (bts:say (strcat "  " fz " is not in this drawing."))))
     (bts:say (strcat "  Issue policy applied - " (itoa n)
                      " freeze(s) added across the viewports.")))
    (t
     (setq lay (getstring T (strcat "\nLayer to " (strcase opt T) " in every viewport: ")))
     (cond
       ((= (bts:trim lay) "") (bts:say "  Cancelled."))
       ((null (bts:lay-ent lay)) (bts:say (strcat "  " lay " is not in this drawing.")))
       (t (setq n 0)
          (foreach vp (bts:all-vports)
            (if (bts:vp-freeze vp lay (= opt "Freeze")) (setq n (1+ n))))
          (bts:say (strcat "  " lay " " (if (= opt "Freeze") "frozen in " "thawed in ")
                           (itoa n) " viewport(s)."))))))
  (princ))

;;; ==================================================================
;;;  COMMANDS - blocks
;;; ==================================================================

(defun C:BTSBLOCKCHECK ()
  (bts:show "BTSBLOCKCHECK - block compliance" (bts:check-blocks))
  (princ))

(defun C:BTSBLOCKPURGE (/ *error* ce blk refs nm cnt gone kept)
  (defun *error* (m)
    (if *pop-error-mode* (*pop-error-mode*))
    (if ce (setvar "CMDECHO" ce))
    (princ (strcat "\nBTSBLOCKPURGE stopped.\n  " m))
    (princ))
  (setq ce (getvar "CMDECHO") gone 0 kept 0)
  (setvar "CMDECHO" 0)
  (bts:head "BTSBLOCKPURGE - safe block purge")
  (setq refs (bts:insert-census))
  (if *push-error-using-command* (*push-error-using-command*))
  (foreach blk (bts:get-blocks)
    (setq nm  (nth 0 blk)
          cnt (cond ((cdr (bts:assoc-ci nm refs))) (t 0)))
    (cond
      ((nth 1 blk) nil)
      ((and (= cnt 0) (bts:wc-any nm *BTS-A-KEEP-BLOCKS*))
       (setq kept (1+ kept)))
      ((= cnt 0)
       (bts:purge-1 "_B" nm)
       (if (bts:block-gone nm)
         (progn (setq gone (1+ gone)) (bts:say (strcat "  purged  " nm)))))))
  (if *pop-error-mode* (*pop-error-mode*))
  (setvar "CMDECHO" ce)
  (bts:rule)
  (bts:say (strcat "  " (itoa gone) " block(s) purged, " (itoa kept)
                   " unused block(s) held back by *BTS-A-KEEP-BLOCKS*."))
  (princ))

(defun C:BTSBLOCKREPORT (/ rows r fn lines)
  (bts:head "BTSBLOCKREPORT - block inventory")
  (setq rows (bts:block-inventory))
  (bts:say (strcat "  " (bts:pad "NAME" 34) (bts:pad "KIND" 11)
                   (bts:pad "USED" 6) (bts:pad "ENTS" 6) "ATTS"))
  (foreach r rows
    (bts:say (strcat "  " (bts:pad (nth 0 r) 34) (bts:pad (nth 1 r) 11)
                     (bts:pad (itoa (nth 2 r)) 6) (bts:pad (itoa (nth 3 r)) 6)
                     (nth 4 r)
                     (if (= (nth 5 r) "") "" (strcat "   " (nth 5 r))))))
  (bts:rule)
  (bts:say (strcat "  " (itoa (length rows)) " block definition(s)."))
  (setq lines (mapcar '(lambda (r)
                         (strcat (bts:pad (nth 0 r) 34) (bts:pad (nth 1 r) 11)
                                 (bts:pad (itoa (nth 2 r)) 6)
                                 (bts:pad (itoa (nth 3 r)) 6) (nth 4 r)))
                      rows))
  (setq fn (bts:report-writer (bts:out-file "_BTSBlocks" ".txt")
                              "Block inventory" lines))
  (if fn (bts:say (strcat "  Written: " fn)))
  (princ))

;;; ==================================================================
;;;  COMMANDS - annotation
;;; ==================================================================

(defun C:BTSTEXTCHECK (/ iss)
  (setq iss (bts:check-text))
  (bts:show "BTSTEXTCHECK - text standards" iss)
  (bts:show-census "Style, height and layer in use" *BTS-A-LAST-CENSUS* "object(s)")
  (princ))

(defun C:BTSDIMCHECK (/ iss)
  (setq iss (bts:check-dims))
  (bts:show "BTSDIMCHECK - dimension standards" iss)
  (bts:show-census "Dimension styles in use" *BTS-A-LAST-DIMSTYLES* "dimension(s)")
  (princ))

(defun C:BTSMLEADERCHECK (/ iss)
  (setq iss (bts:check-leaders))
  (bts:show "BTSMLEADERCHECK - leader standards" iss)
  (bts:show-census "Leader styles in use" *BTS-A-LAST-MLSTYLES* "leader(s)")
  (princ))

;;; ==================================================================
;;;  COMMANDS - auto-fix
;;;
;;;  These three are the prompt-free versions the batch script runs.
;;;  Everything they do is a documented rule from the register, so
;;;  there is nothing here to decide - but they change the drawing.
;;; ==================================================================

(defun C:BTSAUTOFIX (/ *error* ce r v n vp e nv)
  (defun *error* (m)
    (if *pop-error-mode* (*pop-error-mode*))
    (if ce (setvar "CMDECHO" ce))
    (princ (strcat "\nBTSAUTOFIX stopped.\n  " m))
    (princ))
  (setq ce (getvar "CMDECHO"))
  (setvar "CMDECHO" 0)
  (bts:head "BTSAUTOFIX - automated standards correction")
  (setq r (bts:fix))
  (bts:say (strcat "  layers      " (itoa (car r)) " created, "
                   (itoa (cdr r)) " corrected"))
  (setq n 0)
  (foreach v *BTS-VARS*
    (if (not (vl-catch-all-error-p
               (vl-catch-all-apply 'setvar (list (nth 0 v) (nth 1 v)))))
      (setq n (1+ n))))
  (bts:say (strcat "  variables   " (itoa n) " set"))
  (setq n 0 nv 0)
  (foreach vp (bts:all-vports)
    (setq e (entget vp))
    (if (not (bts:member-ci (cdr (assoc 8 e)) '("BTS-L-VPort" "BTS-L-VPortNonPlot")))
      (if (bts:lay-ent "BTS-L-VPortNonPlot")
        (progn
          (entmod (subst (cons 8 "BTS-L-VPortNonPlot") (assoc 8 e) e))
          (setq n (1+ n)))))
    (setq nv (1+ nv)))
  (bts:say (strcat "  viewports   " (itoa n) " of " (itoa nv)
                   " moved to BTS-L-VPortNonPlot"))
  (setvar "CMDECHO" ce)
  (bts:rule)
  (bts:say "  BTSAUTOREMAP clears the legacy layers next.")
  (princ))

(defun C:BTSAUTOREMAP (/ *error* ce r)
  (defun *error* (m)
    (if *pop-error-mode* (*pop-error-mode*))
    (if ce (setvar "CMDECHO" ce))
    (princ (strcat "\nBTSAUTOREMAP stopped.\n  " m))
    (princ))
  (setq ce (getvar "CMDECHO"))
  (setvar "CMDECHO" 0)
  (bts:head "BTSAUTOREMAP - approved remapping rules")
  (if *push-error-using-command* (*push-error-using-command*))
  (bts:fix)
  (setq r (bts:remap-all))
  (command "_.REGENALL")
  (if *pop-error-mode* (*pop-error-mode*))
  (setvar "CMDECHO" ce)
  (bts:say (strcat "  " (itoa (car r)) " object(s) moved, "
                   (itoa (cdr r)) " legacy layer(s) purged."))
  (bts:say "  BTSCHECK lists anything left that needs a decision.")
  (princ))

(defun C:BTSAUTOCLEAN (/ *error* ce res n p)
  (defun *error* (m)
    (if *pop-error-mode* (*pop-error-mode*))
    (if ce (setvar "CMDECHO" ce))
    (princ (strcat "\nBTSAUTOCLEAN stopped.\n  " m))
    (princ))
  (setq ce (getvar "CMDECHO"))
  (setvar "CMDECHO" 0)
  (C:BTSAUTOFIX)
  (C:BTSAUTOREMAP)
  (bts:head "BTSAUTOCLEAN - cleanup")
  (if *push-error-using-command* (*push-error-using-command*))
  (setq res (bts:cleanup))
  (if *pop-error-mode* (*pop-error-mode*))
  (setvar "CMDECHO" ce)
  (foreach p res (bts:say (strcat "  " (bts:pad (car p) 14) (itoa (cdr p)))))
  (setq n (length (bts:audit-full)))
  (bts:rule)
  (bts:say (strcat "  " (itoa n) " item(s) still open - BTSCOMPLETECHECK lists them."))
  (princ))

;;; ==================================================================
;;;  COMMANDS - enterprise
;;; ==================================================================

(defun C:BTSCOMPLETECHECK (/ iss codes p fn)
  (bts:say "Running every BTS check - this takes a moment on a large drawing ...")
  (setq iss (bts:audit-full) codes '())
  (foreach p iss (setq codes (bts:tally (bts:iss-code p) codes)))
  (bts:show "BTSCOMPLETECHECK - full standards validation" iss)
  (bts:say "  By category:")
  (foreach p (bts:sort-count codes)
    (bts:say (strcat "     " (bts:pad (car p) 12) (itoa (cdr p)))))
  (setq fn (bts:report-issues (bts:out-file "_BTSComplete" ".txt")
                              "Complete standards validation" iss))
  (if fn (bts:say (strcat "  Report: " fn)))
  (princ))

(defun C:BTSPROJECTAUDIT (/ dir files scr log)
  (bts:head "BTSPROJECTAUDIT - audit a project directory")
  (if (null (setq dir (bts:pick-folder "Pick any drawing in the project folder")))
    (bts:say "  Cancelled.")
    (progn
      (setq files (bts:batch-folder-scan dir T)
            log   (strcat dir *BTS-A-LOGNAME*)
            scr   (strcat dir "BTS-ProjectAudit.scr"))
      (if (null files)
        (bts:say (strcat "  No drawings found under " dir))
        (progn
          (bts:write-script scr files
                            (strcat "(bts:project-log \"" (bts:fwd log) "\")")
                            nil)
          (bts:say (strcat "  " (itoa (length files))
                           " drawing(s) found, subfolders included."))
          (bts:say (strcat "  Script : " scr))
          (bts:say (strcat "  Log    : " log))
          (bts:rule)
          (bts:say "  Run SCRIPT on the file above from a blank drawing,")
          (bts:say "  then BTSPROJECTREPORT to summarise the log.")))))
  (princ))

(defun C:BTSPROJECTREPORT (/ log rows r dwgs codes worst lines fn n tot p)
  (bts:head "BTSPROJECTREPORT - project compliance")
  (if (null (setq log (getfiled "Select the BTS project log" (bts:dwg-dir) "csv" 0)))
    (bts:say "  Cancelled.")
    (progn
      (setq rows (bts:csv-read log) dwgs '() codes '() tot 0)
      (foreach r rows
        (cond
          ((= (strcase (bts:fld r 0)) "DRAWING")
           (setq dwgs (bts:tally-n (bts:fld r 1) (atoi (bts:fld r 4)) dwgs)))
          ((= (strcase (bts:fld r 0)) "ISSUE")
           (setq codes (bts:tally (bts:fld r 2) codes)
                 tot   (1+ tot)))))
      (setq n (length dwgs))
      (if (= n 0)
        (bts:say "  That file holds no BTS project rows - run BTSPROJECTAUDIT first.")
        (progn
          (setq lines (list (strcat "Drawings audited : " (itoa n))
                            (strcat "Deviations       : " (itoa tot))
                            (strcat "Average          : "
                                    (rtos (/ (float tot) n) 2 1) " per drawing")
                            ""
                            "By category"))
          (foreach p (bts:sort-count codes)
            (setq lines (append lines (list (strcat "  " (bts:pad (car p) 12) (itoa (cdr p)))))))
          (setq lines (append lines (list "" "Worst first")))
          (setq worst (bts:sort-count dwgs))
          (foreach p worst
            (setq lines (append lines
                                (list (strcat "  " (bts:pad (car p) 44)
                                              (itoa (cdr p)) " deviation(s)")))))
          (foreach p lines (bts:say (strcat "  " p)))
          (bts:rule)
          (setq fn (bts:report-writer
                     (strcat (bts:end-slash (vl-filename-directory log))
                             "BTS-Project-Report.txt")
                     "Project compliance report" lines))
          (if fn (bts:say (strcat "  Report: " fn)))))))
  (princ))

;;; ---- BTSPACKAGE : build an issue package ----
(defun C:BTSPACKAGE (/ dir code base out files rows f n sz manifest)
  (bts:head "BTSPACKAGE - build an issue package")
  (if (null (setq dir (bts:pick-folder "Pick any drawing in the folder to issue")))
    (bts:say "  Cancelled.")
    (progn
      (setq code (bts:trim (getstring T "\nIssue or revision code (e.g. P01, S2): ")))
      (if (= code "") (setq code "ISSUE"))
      (setq base  (strcat dir "ISSUE_" code "_" (bts:datestamp))
            out   (strcat base "\\")
            files (bts:batch-folder-scan dir nil)
            n     0
            rows  (list (list "FILE" "SIZE" "PACKAGED" "ISSUE" "SUITE" "" "" "")))
      (cond
        ((null files) (bts:say (strcat "  No drawings found in " dir)))
        ((and (null (findfile base)) (null (vl-mkdir base)))
         (bts:say (strcat "  Could not create " base)))
        (t
         (foreach f files
           (setq sz (vl-file-size f))
           (if (vl-file-copy f (strcat out (vl-filename-base f) (vl-filename-extension f)))
             (progn
               (setq n (1+ n))
               (setq rows (append rows
                                  (list (list (strcat (vl-filename-base f)
                                                      (vl-filename-extension f))
                                              (if sz (itoa sz) "?")
                                              (bts:stamp) code
                                              *BTS-A-VERSION* "" "" "")))))
             (bts:say (strcat "  could not copy " f))))
         (setq manifest (bts:csv-writer (strcat out "MANIFEST.csv") rows))
         (bts:say (strcat "  " (itoa n) " drawing(s) copied to:"))
         (bts:say (strcat "     " out))
         (if manifest (bts:say (strcat "  Manifest: " manifest)))
         (bts:rule)
         (bts:say "  Run BTSCOMPLETECHECK on each drawing before the package leaves.")))))
  (princ))


;;; ==================================================================
;;;  PART 5 - HELP AND LOAD BANNER
;;; ==================================================================

(setq *BTS-HELP* '(
  ("BTSHELP"     "This list.")
  ("BTSCHECK"    "Audit the drawing against the standard. Changes nothing.")
  (""            "Reports MISSING, wrong properties, LEGACY, REVIEW, NONSTD.")
  ("BTSFIX"      "Create missing layers and correct colour, linetype,")
  (""            "lineweight, plot state, transparency and descriptions.")
  ("BTSREMAP"    "Move objects off legacy layers onto their replacements,")
  (""            "splitting hatch fills onto the -Hatch layers, then purge.")
  ("BTSVARS"     "Check the drawing variables. Offers to set them.")
  ("BTSJUNK"     "Report bound-xref residue, dead title blocks and")
  (""            "PDF-import text styles. Review before purging.")
  ("BTSOVERRIDE" "Report objects whose colour, lineweight or transparency")
  (""            "is set BYOBJECT instead of ByLayer.")
  ("BTSREPORT"   "Write the BTSCHECK audit to a .txt beside the drawing.")
  ("BTSAHELP"    "The Approver Standards suite - 41 further commands.")
))

(defun C:BTSHELP (/ row)
  (bts:say (strcat "BTS " *BTS-STD-VERSION* " - commands"))
  (bts:say "--------------------------------------------------------------")
  (foreach row *BTS-HELP*
    (bts:say (strcat "  " (bts:pad (car row) 14) (cadr row))))
  (bts:say "--------------------------------------------------------------")
  (bts:say "  Usual order on an inherited drawing:")
  (bts:say "    BTSCHECK  ->  BTSFIX  ->  BTSREMAP  ->  BTSCHECK")
  (bts:say "  BTSCHECK, BTSJUNK, BTSOVERRIDE and BTSREPORT are read-only.")
  (bts:say "  BTSFIX and BTSREMAP modify the drawing - work on a copy first.")
  (princ))

;;; ==================================================================

(setq *BTS-A-HELP* '(
  ("BTSAHELP"        "This list. BTSHELP covers the register commands.")
  ("-- advanced --"  "")
  ("BTSLAYERS"       "Rebuild the whole layer register: create, correct,")
  (""                "thaw, unlock and restore every description.")
  ("BTSCLEAN"        "BTSCHECK, BTSFIX, BTSVARS and BTSPURGE in order.")
  ("BTSAUDIT"        "AUDIT in report mode, plus proxies, unresolved xrefs")
  (""                "and name hygiene.")
  ("BTSRECOVER"      "Backup, fixing AUDIT and protected purge.")
  ("BTSPURGE"        "Purge, holding back the standard and the keep lists.")
  ("BTSPLOTCHECK"    "Plot readiness: page setups, styles, viewports,")
  (""                "scales and content that will not reach paper.")
  ("BTSTITLECHECK"   "Title block metadata, including who approved it.")
  ("BTSDWGINFO"      "Drawing metadata and an object census.")
  ("BTSUNITS"        "Units verification. Offers to correct them.")
  ("-- CAD manager --" "")
  ("BTSBATCHCHECK"   "Write a script that audits every drawing in a folder.")
  ("BTSBATCHFIX"     "Write a script that repairs and saves them.")
  ("BTSEXPORTCSV"    "Audit, layers, variables and statistics as CSV.")
  ("BTSEXPORTJSON"   "The same as JSON.")
  ("BTSSTATS"        "Object, layer and utility run length statistics.")
  ("BTSCOMPARE"      "Diff a CSV snapshot against this drawing or another.")
  ("-- utility --"   "")
  ("BTSUTILCHECK"    "Apparatus layer compliance, service by service.")
  ("BTSLTYPECHECK"   "Linetypes on the utility layers.")
  ("BTSQLCHECK"      "PAS 128 quality level attribution.")
  ("BTSCONFLICTS"    "Crossings and clearance breaches between services.")
  ("-- GIS --"       "")
  ("BTSBNGCHECK"     "British National Grid validation.")
  ("BTSGRIDCHECK"    "Grid line spacing and label agreement.")
  ("BTSCOORDS"       "Extents, centre and OS grid square.")
  ("-- sheets --"    "")
  ("BTSSHEETCHECK"   "Layouts, viewports and title blocks per sheet.")
  ("BTSLAYOUTCHECK"  "Layout naming and page setup.")
  ("BTSVIEWPORTS"    "Viewport table and findings.")
  ("BTSVPLOCK"       "Lock every viewport.")
  ("BTSVPFREEZE"     "Report, freeze or thaw a layer in every viewport,")
  (""                "or apply the issue policy in *BTS-A-VPFREEZE*.")
  ("-- blocks --"    "")
  ("BTSBLOCKCHECK"   "Block compliance and definition contents.")
  ("BTSBLOCKPURGE"   "Purge unused blocks, keeping title blocks.")
  ("BTSBLOCKREPORT"  "Block inventory with reference counts.")
  ("-- annotation --" "")
  ("BTSTEXTCHECK"    "Text styles, heights and layers.")
  ("BTSDIMCHECK"     "Dimension styles and overrides.")
  ("BTSMLEADERCHECK" "Leader styles and layers.")
  ("-- auto --"      "")
  ("BTSAUTOFIX"      "Register, variables and viewport layers, no prompts.")
  ("BTSAUTOREMAP"    "Every approved remapping rule, no prompts.")
  ("BTSAUTOCLEAN"    "Auto-fix, auto-remap, cleanup and a fresh count.")
  ("-- enterprise --" "")
  ("BTSPROJECTAUDIT" "Script an audit of a whole project tree.")
  ("BTSPROJECTREPORT" "Summarise the project log for management.")
  ("BTSPACKAGE"      "Copy an issue set out with a manifest.")
  ("BTSCOMPLETECHECK" "Every check in the suite, one report.")
))

(defun C:BTSAHELP (/ row)
  (bts:say (strcat "BTS " *BTS-A-VERSION* " - commands"))
  (bts:rule)
  (foreach row *BTS-A-HELP*
    (bts:say (strcat "  " (bts:pad (car row) 18) (cadr row))))
  (bts:rule)
  (bts:say "  Usual order on an inherited drawing:")
  (bts:say "    BTSCOMPLETECHECK -> BTSLAYERS -> BTSAUTOREMAP -> BTSCOMPLETECHECK")
  (bts:say "  Before issue:")
  (bts:say "    BTSTITLECHECK -> BTSVPFREEZE Standard -> BTSVPLOCK -> BTSPLOTCHECK")
  (bts:say "  Everything named *CHECK is read-only. The rest changes the drawing.")
  (bts:say "  BTSHELP lists BTSCHECK, BTSFIX, BTSREMAP and the rest of the register set.")
  (princ))

(bts:say (strcat "BTS Standards tools loaded - " *BTS-STD-VERSION*))
(bts:say (strcat "                            " *BTS-A-VERSION*))
(bts:say (strcat "  " (itoa (length *BTS-LAYERS*)) " layers in the register. "
                 "Self contained - BTSStandards.lsp is not needed."))
(bts:say "  BTSHELP lists the register commands, BTSAHELP the approver suite.")
(princ)
