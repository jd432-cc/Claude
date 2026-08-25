;;; ==================================================================
;;;  BTS-Standards-R-v1.1.lsp
;;;  BTS Layer Standard Release v1.1 : standards checker for AutoCAD LT 2024+
;;;  Register synchronised to BTS-Standard-RevE.dws.

;;;
;;;  COMMANDS
;;;    BTSCHECK   audit, report only, changes nothing
;;;    BTSFIX     create missing layers, correct properties + descriptions
;;;    BTSREMAP   move objects off legacy layers, then purge them
;;;    BTSVARS    check and optionally set drawing variables
;;;    BTSJUNK    report template residue (bound xrefs, dead blocks)
;;;    BTSOVERRIDE report objects whose appearance is set BYOBJECT
;;;    BTSREPORT  write a .txt report beside the drawing

;;; ==================================================================

(vl-load-com)

(setq *BTS-STD-VERSION* "Layer Standard - Release v1.1")

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

;;; ------------------------------------------------------------------
;;;  Helpers
;;; ------------------------------------------------------------------

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

;;; ------------------------------------------------------------------
;;;  Audit. Returns a list of "CODE     |layer|detail" strings.
;;; ------------------------------------------------------------------

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
;;;  BTSHELP  -  list the commands and what they do
;;; ------------------------------------------------------------------

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

(bts:say (strcat "BTS Standards tools loaded (" *BTS-STD-VERSION* ")."))
(bts:say "Commands: BTSCHECK  BTSFIX  BTSREMAP  BTSVARS  BTSJUNK  BTSREPORT  BTSHELP")
(princ)