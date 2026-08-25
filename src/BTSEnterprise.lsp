;;; ==================================================================
;;;  BTSEnterprise.lsp
;;;  BTS Enterprise Standards Suite - core engine
;;;  AutoCAD LT 2024+ / AutoCAD 2024+
;;;
;;;  Merged from BTS-Standards-R-v1.1.lsp. Register synchronised to
;;;  BTS-Standard-RevE.dws.
;;;
;;;  Pure AutoLISP throughout - entmake / entget / entmod / ssget /
;;;  tblnext and DXF group codes. No ActiveX, no ObjectDBX, no VBA.
;;;  AutoCAD LT has none of those, and the batch layer is built on
;;;  generated scripts for the same reason - see BTSBatch.lsp.
;;;
;;;  Engines return data. Commands print. Everything in this file that
;;;  is named bts:* returns a value and writes nothing to the screen, so
;;;  the batch and project layers can call it and collect the result.
;;;
;;;  FINDINGS are strings of the form  "CODE|subject|detail".
;;;  The code root - the part before the first hyphen - drives scoring
;;;  through *BTS-SEVERITY*.
;;;
;;;  COMMANDS
;;;    BTSCHECK    audit, report only, changes nothing
;;;    BTSFIX      create missing layers, correct properties + descriptions
;;;    BTSREMAP    move objects off legacy layers, then purge them
;;;    BTSVARS     check and optionally set drawing variables
;;;    BTSJUNK     report template residue (bound xrefs, dead blocks)
;;;    BTSOVERRIDE report objects whose appearance is set BYOBJECT
;;;    BTSREPORT   write a .txt report beside the drawing
;;;    BTSHELP     list every command the loaded modules provide
;;; ==================================================================

(vl-load-com)

(setq *BTS-STD-VERSION* "Enterprise Standards Suite v2.0 (register Rev E)")

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

;;; ---- Layers needing a decision by the user. The layers below are not
;;;      remapped automatically. Wild-card patterns matched with wcmatch.
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

;;; ---- Title block register: (block-name-pattern required-attribute-tags)
;;;      Patterns are wcmatch, tested against the upper-cased block name.
(setq *BTS-TITLEBLOCK* '(
  ("BTS-TB*"  ("DRAWINGNUMBER" "REVISION" "TITLE" "CLIENT" "PROJECT"
               "SCALE" "DATE" "DRAWNBY" "CHECKEDBY"))
  ("TB `- *"  ("DRAWINGNUMBER" "REVISION" "TITLE"))
))

;;; ---- Plot scales a viewport is allowed to use, as 1:n.
(setq *BTS-VP-SCALES* '(50 100 200 250 500 1000 1250 2500 5000 10000))

;;; ---- Paper space units per millimetre. Sheets are drawn in mm, model
;;;      geometry in BNG metres, so the viewport scale denominator is
;;;      (model units per paper unit) x 1000 / this.
(setq *BTS-PAPER-UNITS-PER-MM* 1.0)

;;; ---- British National Grid envelope, metres. Used to sanity-check that
;;;      model geometry really is georeferenced and not on local coords.
(setq *BTS-BNG-ENVELOPE* '(0.0 0.0 700000.0 1300000.0))

;;; ---- Deviation weight by code root. Anything unlisted counts 1.
(setq *BTS-SEVERITY* '(
  ("MISSING" . 3) ("LEGACY" . 3) ("NONSTD" . 2) ("REVIEW" . 1)
  ("COLOUR" . 1) ("LINETYPE" . 1) ("LWEIGHT" . 1) ("PLOT" . 2) ("TRANSP" . 1)
  ("OVR" . 2) ("VAR" . 1) ("UNITS" . 3) ("TB" . 3) ("VP" . 2)
  ("QL" . 3) ("TXT" . 1) ("JUNK" . 1) ("XREF" . 3) ("ISSUE" . 3)
  ;; Exact codes override their root where the root weight is too blunt.
  ("QL-SHARED" . 1) ("TXT-HEIGHT" . 1) ("VP-UNLOCKED" . 1)
))

;;; ------------------------------------------------------------------
;;;  Primitives
;;; ------------------------------------------------------------------

(defun bts:say (s) (princ (strcat "\n" s)))
(defun bts:pad (s n) (while (< (strlen s) n) (setq s (strcat s " "))) s)

(defun bts:uniq (l / out x)
  (foreach x l (if (not (member x out)) (setq out (cons x out))))
  (reverse out))

;;; Findings are "CODE|subject|detail". A detail containing a pipe keeps it.
(defun bts:split (s / p q)
  (if (setq p (vl-string-search "|" s))
    (if (setq q (vl-string-search "|" s (1+ p)))
      (list (substr s 1 p) (substr s (+ p 2) (- q p 1)) (substr s (+ q 2)))
      (list (substr s 1 p) (substr s (+ p 2)) ""))
    (list s "" "")))

(defun bts:code-root (code / p)
  (if (setq p (vl-string-search "-" code)) (substr code 1 p) code))

(defun bts:fmt (s / p)
  (setq p (bts:split s))
  (strcat (bts:pad (nth 0 p) 12) (bts:pad (nth 1 p) 32) (nth 2 p)))

;;; Running (key . count) tally, used to aggregate per-object findings up
;;; to one line per layer. Reporting 4000 identical overrides helps nobody.
(defun bts:tally (key lst / hit)
  (if (setq hit (assoc key lst))
    (subst (cons key (1+ (cdr hit))) hit lst)
    (cons (cons key 1) lst)))

(defun bts:tally->findings (tal suffix / out p)
  (foreach p (reverse tal)
    (setq out (cons (strcat (car p) "|" (itoa (cdr p)) " " suffix) out)))
  (reverse out))

(defun bts:faults (findings / out f)
  (foreach f findings
    (if (not (member (car (bts:split f)) '("INFO" "META")))
      (setq out (cons f out))))
  (reverse out))

(defun bts:score (findings / pts c f)
  (setq pts 0)
  (foreach f findings
    (setq c   (car (bts:split f))
          pts (+ pts (cond
                       ;; INFO lines carry counts and context, not faults.
                       ((member c '("INFO" "META")) 0)
                       ((cdr (assoc c *BTS-SEVERITY*)))
                       ((cdr (assoc (bts:code-root c) *BTS-SEVERITY*)))
                       (t 1)))))
  (max 0 (- 100 pts)))

(defun bts:lw->str (lw / whole frac)
  (cond
    ((or (null lw) (< lw 0)) "DEFAULT")
    (t (setq whole (fix (/ lw 100)) frac (rem lw 100))
       (strcat (itoa whole) "."
               (if (< frac 10) (strcat "0" (itoa frac)) (itoa frac))))))

;;; Trailing-slash-normalised, forward slashes throughout. Scripts and
;;; (load) both accept forward slashes on Windows, and they survive being
;;; written into a LISP string without doubling.
(defun bts:dir-norm (d)
  (setq d (vl-string-translate "\\" "/" d))
  (if (= "/" (substr d (strlen d) 1)) d (strcat d "/")))

(defun bts:dwg-path () (strcat (getvar "DWGPREFIX") (getvar "DWGNAME")))

;;; ------------------------------------------------------------------
;;;  Layer primitives
;;; ------------------------------------------------------------------

(defun bts:lay-ent (nm) (tblobjname "LAYER" nm))

(defun bts:get-all-layers (/ n out)
  (setq n (tblnext "LAYER" T))
  (while n
    (setq out (cons (cdr (assoc 2 n)) out) n (tblnext "LAYER")))
  (reverse out))

;;; Layers that are ours to judge: not 0, not Defpoints, not xref-owned.
(defun bts:layer-auditable (nm)
  (and (not (= (strcase nm) "0"))
       (not (= (strcase nm) "DEFPOINTS"))
       (not (wcmatch nm "*|*"))))

;;; Case-insensitive lookups. AutoLISP assoc is case-sensitive; AutoCAD
;;; layer names are not.
(defun bts:spec-of (nm / p hit)
  (foreach p *BTS-LAYERS*
    (if (and (null hit) (= (strcase (car p)) (strcase nm))) (setq hit p)))
  hit)

(defun bts:lay-in-standard (nm) (if (bts:spec-of nm) T nil))

(defun bts:remap-of (nm / p hit)
  (foreach p *BTS-REMAP*
    (if (and (null hit) (= (strcase (car p)) (strcase nm))) (setq hit p)))
  hit)

(defun bts:split-of (nm / p hit)
  (foreach p *BTS-SPLIT*
    (if (and (null hit) (= (strcase (car p)) (strcase nm))) (setq hit p)))
  hit)

;;; Does this layer need a human decision rather than a remap?
(defun bts:review-of (nm / p hit)
  (foreach p *BTS-REVIEW*
    (if (and (null hit) (wcmatch (strcase nm) (strcase (car p)))) (setq hit p)))
  hit)

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

;;; Encode a transparency percentage: 0x02000000 + alpha, alpha 255 = opaque.
;;; Same encoding whether stored as entity code 440 or layer xdata 1071.
(defun bts:trans-code (pct)
  (+ 33554432 (fix (+ 0.5 (- 255.0 (* 2.55 pct))))))

;;; Set a DXF group code on a layer table record directly.
(defun bts:set-dxf (nm code val / e)
  (if (setq e (tblobjname "LAYER" nm))
    (progn
      (setq e (entget e))
      (entmod (if (assoc code e)
                (subst (cons code val) (assoc code e) e)
                (append e (list (cons code val))))))))

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

;;; Create a layer table record without going near (command).
(defun bts:create-layer (nm col lt lw pl)
  (entmake (list '(0 . "LAYER")
                 '(100 . "AcDbSymbolTableRecord")
                 '(100 . "AcDbLayerTableRecord")
                 (cons 2 nm)
                 '(70 . 0)
                 (cons 62 col)
                 (cons 6 (if (= lt "ByLayer") "Continuous" lt))
                 (cons 370 lw)
                 (cons 290 pl))))

(defun bts:update-layer (nm col lt lw pl)
  (if (bts:lay-ent nm)
    (progn
      (bts:set-dxf nm 62  col)
      (bts:set-dxf nm 6   (if (= lt "ByLayer") "Continuous" lt))
      (bts:set-dxf nm 370 lw)
      (bts:set-dxf nm 290 pl)
      T)))

;;; Thaw, turn on and unlock via DXF rather than -LAYER keywords, so a
;;; locked or frozen legacy layer cannot block the remap.
(defun bts:layer-open (nm / e)
  (if (setq e (bts:lay-ent nm))
    (progn
      (bts:set-dxf nm 70 (logand (cdr (assoc 70 (entget e))) (~ 5)))
      (bts:set-dxf nm 62 (abs (cdr (assoc 62 (entget (bts:lay-ent nm)))))))))

;;; How many objects are still on this layer, model + layouts + block defs?
(defun bts:count-on-layer (lay / ss n bn bent e)
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
(defun bts:move-selection (old new flt / ss i e n)
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
;;; TYPES is a list of DXF type names; INVERT non-nil means "everything
;;; except those types".
(defun bts:move-block-contents (old new types invert / bn bent e n ty)
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

(defun bts:remap-layer (old new)
  (+ (bts:move-selection old new '())
     (bts:move-block-contents old new '() T)))

;;; Returns (boundary-count . hatch-count).
(defun bts:split-layer (old bnd hlay / nh nb)
  (setq nh (+ (bts:move-selection old hlay
                '((-4 . "<OR") (0 . "HATCH") (0 . "SOLID") (-4 . "OR>")))
              (bts:move-block-contents old hlay '("HATCH" "SOLID") nil))
        nb (+ (bts:move-selection old bnd
                '((-4 . "<NOT")
                  (-4 . "<OR") (0 . "HATCH") (0 . "SOLID") (-4 . "OR>")
                  (-4 . "NOT>")))
              (bts:move-block-contents old bnd '("HATCH" "SOLID") T)))
  (cons nb nh))

;;; Re-point per-viewport frozen-layer references from OLD to NEW.
;;; DXF 341 on a VIEWPORT holds one entry per VP-frozen layer. A layer
;;; named there counts as REFERENCED, so -PURGE refuses it even when the
;;; layer holds no objects. Deleting the entry would unfreeze the layer in
;;; that viewport and change what plots, so it is re-pointed instead - the
;;; VP freeze carries across to the new layer.
(defun bts:vp-refreeze (old new / oe ne ss i vp el out seen lay n p)
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

;;; Purge a layer only when it is genuinely safe to. Returns one of
;;; 'purged 'gone 'protected 'current 'referenced, or the integer count
;;; of objects still sitting on it.
(defun bts:purge-safe (nm / n)
  (cond
    ((null (bts:lay-ent nm)) 'gone)
    ((not (bts:layer-auditable nm)) 'protected)
    ((= (strcase (getvar "CLAYER")) (strcase nm)) 'current)
    ((> (setq n (bts:count-on-layer nm)) 0) n)
    (t (if *push-error-using-command* (*push-error-using-command*))
       (command "_.-PURGE" "_LA" nm "_N")
       (if *pop-error-mode* (*pop-error-mode*))
       (if (bts:lay-ent nm) 'referenced 'purged))))

(defun bts:delete-layer (nm) (bts:purge-safe nm))

;;; ------------------------------------------------------------------
;;;  Database queries
;;; ------------------------------------------------------------------

(defun bts:get-blocks (/ n out nm flags)
  (setq n (tblnext "BLOCK" T))
  (while n
    (setq nm    (cdr (assoc 2 n))
          flags (cond ((cdr (assoc 70 n))) (t 0)))
    (if (not (wcmatch (strcase nm) "`*MODEL_SPACE*,`*PAPER_SPACE*"))
      (setq out (cons (list nm
                            (if (zerop (logand flags 4)) nil T)   ; xref?
                            (cond ((cdr (assoc 1 n))) (t "")))    ; xref path
                      out)))
    (setq n (tblnext "BLOCK")))
  (reverse out))

(defun bts:get-layouts (/ d p out)
  (if (setq d (dictsearch (namedobjdict) "ACAD_LAYOUT"))
    (foreach p d
      (if (and (= (car p) 3) (/= (strcase (cdr p)) "MODEL"))
        (setq out (cons (cdr p) out)))))
  (reverse out))

;;; One record per paper-space viewport:
;;;   (layout handle layer locked scale-denominator frozen-layer-count)
;;; Scale comes from DXF 41 (paper height) over 45 (view height in model
;;; units); the 1:1 pseudo-viewport that every layout carries is skipped.
(defun bts:scan-viewport (/ ss i e out ph vh den lock)
  (if (setq ss (ssget "_X" '((0 . "VIEWPORT"))))
    (progn
      (setq i 0)
      (repeat (sslength ss)
        (setq e  (entget (ssname ss i))
              ph (cond ((cdr (assoc 41 e))) (t 0.0))
              vh (cond ((cdr (assoc 45 e))) (t 0.0)))
        ;; group 68 = 0 means the viewport is off / not active; group 69 = 1
        ;; is the paper-space pseudo-viewport, never a real one.
        (if (/= 1 (cond ((cdr (assoc 69 e))) (t 1)))
          (progn
            (setq den  (if (> ph 0.0)
                         (/ (* 1000.0 (/ vh ph)) *BTS-PAPER-UNITS-PER-MM*)
                         0.0)
                  lock (if (zerop (logand (cond ((cdr (assoc 90 e))) (t 0))
                                          16384))
                         nil T)
                  out  (cons (list (cond ((cdr (assoc 410 e))) (t "?"))
                                   (cdr (assoc 5 e))
                                   (cdr (assoc 8 e))
                                   lock
                                   den
                                   (length (bts:all-of 341 e)))
                             out))))
        (setq i (1+ i)))))
  (reverse out))

(defun bts:all-of (code el / p out)
  (foreach p el (if (= (car p) code) (setq out (cons (cdr p) out))))
  (reverse out))

;;; Attribute tag/value pairs on an INSERT, as (("TAG" . "value") ...).
(defun bts:attribs-of (en / e out)
  (if (= 1 (cond ((cdr (assoc 66 (entget en)))) (t 0)))
    (progn
      (setq en (entnext en))
      (while (and en (setq e (entget en)) (= "ATTRIB" (cdr (assoc 0 e))))
        (setq out (cons (cons (strcase (cdr (assoc 2 e)))
                              (cond ((cdr (assoc 1 e))) (t "")))
                        out)
              en  (entnext en)))))
  (reverse out))

;;; Plain text out of a TEXT or MTEXT entity. MTEXT splits long content
;;; across repeated group 3 chunks with the tail in group 1, and carries
;;; inline formatting that would otherwise break token matching.
(defun bts:text-of (e / ty s p)
  (setq ty (cdr (assoc 0 e)) s "")
  (cond
    ((= ty "MTEXT")
     (foreach p e (if (= (car p) 3) (setq s (strcat s (cdr p)))))
     (bts:mtext-plain (strcat s (cond ((cdr (assoc 1 e))) (t "")))))
    (t (cond ((cdr (assoc 1 e))) (t "")))))

;;; Strip the MTEXT inline codes that matter for token matching: brace
;;; grouping, \P paragraph breaks, and the \x...; property runs.
(defun bts:mtext-plain (s / i c out n)
  (setq out "" i 1 n (strlen s))
  (while (<= i n)
    (setq c (substr s i 1))
    (cond
      ((or (= c "{") (= c "}")) (setq i (1+ i)))
      ((= c "\\")
       (setq c (substr s (1+ i) 1))
       (cond
         ((or (= c "P") (= c "p")) (setq out (strcat out " ") i (+ i 2)))
         ((member (strcase c) '("F" "C" "H" "W" "Q" "T" "A" "S"))
          (setq i (+ i 2))
          (while (and (<= i n) (/= (substr s i 1) ";")) (setq i (1+ i)))
          (setq i (1+ i)))
         (t (setq out (strcat out c) i (+ i 2)))))
      (t (setq out (strcat out c) i (1+ i))))) 
  out)

;;; ------------------------------------------------------------------
;;;  bts:audit  -  master audit engine. Layer table only.
;;; ------------------------------------------------------------------

(defun bts:audit (/ res spec nm col lt lw pl tr e ecol elt elw epl etr known n)
  (setq res '() known '())
  (foreach spec *BTS-LAYERS*
    (setq nm  (nth 0 spec) col (nth 1 spec) lt (nth 2 spec)
          lw  (nth 3 spec) pl  (nth 4 spec) tr (nth 5 spec)
          known (cons (strcase nm) known))
    (if (null (setq e (bts:lay-ent nm)))
      (setq res (cons (strcat "MISSING|" nm "|layer not present") res))
      (progn
        (setq e    (entget e)
              ecol (abs (cond ((cdr (assoc 62 e))) (t 7)))
              elt  (cond ((cdr (assoc 6 e))) (t "Continuous"))
              elw  (cond ((assoc 370 e) (cdr (assoc 370 e))) (t -3))
              epl  (cond ((assoc 290 e) (cdr (assoc 290 e))) (t 1))
              etr  (bts:trans-pct nm))
        (if (not (= ecol col))
          (setq res (cons (strcat "COLOUR|" nm "|is " (itoa ecol)
                                  ", should be " (itoa col)) res)))
        (if (and (not (= lt "ByLayer"))
                 (not (= (strcase elt) (strcase lt))))
          (setq res (cons (strcat "LINETYPE|" nm "|is " elt
                                  ", should be " lt) res)))
        (if (not (= elw lw))
          (setq res (cons (strcat "LWEIGHT|" nm "|is " (bts:lw->str elw)
                                  ", should be " (bts:lw->str lw)) res)))
        (if (not (= epl pl))
          (setq res (cons (strcat "PLOT|" nm "|is "
                                  (if (= epl 1) "Yes" "No") ", should be "
                                  (if (= pl 1) "Yes" "No")) res)))
        (if (> (abs (- etr tr)) 2)
          (setq res (cons (strcat "TRANSP|" nm "|is " (itoa etr)
                                  "%, should be " (itoa tr) "%") res))))))
  (setq n (tblnext "LAYER" T))
  (while n
    (setq nm (cdr (assoc 2 n)))
    (if (and (not (member (strcase nm) known)) (bts:layer-auditable nm))
      (setq res (cons
        (cond
          ((bts:remap-of nm)
           (strcat "LEGACY|" nm "|remap to " (cdr (bts:remap-of nm))))
          ((bts:review-of nm)
           (strcat "REVIEW|" nm "|" (cdr (bts:review-of nm))))
          (t (strcat "NONSTD|" nm "|not in the BTS standard")))
        res)))
    (setq n (tblnext "LAYER")))
  (reverse res))

;;; ------------------------------------------------------------------
;;;  bts:fix  -  master repair engine. Layer table only, no geometry.
;;;  Returns (created . updated).
;;; ------------------------------------------------------------------

(defun bts:fix (/ spec nm made fixed)
  (setq made 0 fixed 0)
  (foreach spec *BTS-LAYERS*
    (setq nm (nth 0 spec))
    (if (null (bts:lay-ent nm))
      (progn (bts:create-layer nm (nth 1 spec) (nth 2 spec)
                               (nth 3 spec) (nth 4 spec))
             (setq made (1+ made)))
      (progn (bts:update-layer nm (nth 1 spec) (nth 2 spec)
                               (nth 3 spec) (nth 4 spec))
             (setq fixed (1+ fixed))))
    (bts:set-lay-xdata nm (nth 6 spec) (nth 5 spec)))
  (cons made fixed))

;;; ------------------------------------------------------------------
;;;  bts:remap-all  -  the BTSREMAP engine.
;;;  Returns an assoc list: moved purged split lines left review.
;;; ------------------------------------------------------------------

(defun bts:res (key res) (cdr (assoc key res)))

(defun bts:remap-all (/ work pair old new hlay lines moved gone nsplit
                        counts nvp nleft rec nm left nrev)
  (setq lines '() moved 0 gone 0 nsplit 0 left '() nrev 0)

  ;; Splits first, then plain remaps not already covered by a split.
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
         (setq lines (cons (strcat "  SKIPPED " old " - target " new
                                   " missing. Run BTSFIX first.") lines)))
        ((and hlay (null (bts:lay-ent hlay)))
         (setq lines (cons (strcat "  SKIPPED " old " - hatch target " hlay
                                   " missing. Run BTSFIX first.") lines)))
        (t
         (bts:layer-open old)
         (if hlay
           (progn
             (setq counts (bts:split-layer old new hlay)
                   moved  (+ moved (car counts) (cdr counts)))
             (if (> (cdr counts) 0) (setq nsplit (1+ nsplit)))
             (setq lines (cons (strcat "  " old
                                       "\n      -> " new "   ("
                                       (itoa (car counts)) " boundary)"
                                       "\n      -> " hlay "   ("
                                       (itoa (cdr counts)) " fill)") lines)))
           (progn
             (setq counts (bts:remap-layer old new)
                   moved  (+ moved counts)
                   lines  (cons (strcat "  " old " -> " new "   ("
                                        (itoa counts) " object"
                                        (if (= counts 1) ")" "s)")) lines))))

         (if (= (strcase (getvar "CLAYER")) (strcase old))
           (setvar "CLAYER" new))

         ;; Carry any per-viewport freeze across before purging.
         (setq nvp (bts:vp-refreeze old new))
         (if (> nvp 0)
           (setq lines (cons (strcat "      " (itoa nvp)
                                     " viewport freeze reference(s) moved to "
                                     new) lines)))

         (setq nleft (bts:purge-safe old))
         (cond
           ((= nleft 'purged) (setq gone (1+ gone)))
           ((= nleft 'current)
            (setq lines (cons (strcat "      NOT PURGED - " old
                                      " is the current layer.") lines)))
           ((= nleft 'referenced)
            (setq lines (cons (strcat "      NOT PURGED - layer is empty but"
                                      " still referenced.\n      Check for a"
                                      " saved layer state (LAYERSTATE), a layer"
                                      " filter,\n      or a viewport property"
                                      " override, then PURGE by hand.") lines)))
           ((numberp nleft)
            (setq lines (cons (strcat "      NOT PURGED - " (itoa nleft)
                                      " object(s) could not be moved."
                                      "\n      Likely inside an xref, or a block"
                                      " this routine cannot edit.") lines))))))))

  ;; Never finish silently: say what was left behind and why.
  (setq rec (tblnext "LAYER" T))
  (while rec
    (setq nm (cdr (assoc 2 rec)))
    (if (and (bts:layer-auditable nm)
             (null (bts:remap-of nm))
             (null (bts:lay-in-standard nm)))
      (if (bts:review-of nm)
        (setq nrev (1+ nrev))
        (setq left (cons nm left))))
    (setq rec (tblnext "LAYER")))

  (list (cons "moved" moved) (cons "purged" gone) (cons "split" nsplit)
        (cons "lines" (reverse lines)) (cons "left" (reverse left))
        (cons "review" nrev)))

;;; ------------------------------------------------------------------
;;;  bts:cleanup  -  master cleanup engine. Reports, purges nothing.
;;; ------------------------------------------------------------------

(defun bts:cleanup (/ n out nm)
  (setq n (tblnext "LAYER" T))
  (while n
    (if (wcmatch (cdr (assoc 2 n)) "*`@*")
      (setq out (cons (strcat "JUNK-XREFLAY|" (cdr (assoc 2 n))
                              "|bound xref layer") out)))
    (setq n (tblnext "LAYER")))
  (setq n (tblnext "BLOCK" T))
  (while n
    (setq nm (cdr (assoc 2 n)))
    (cond
      ((wcmatch nm "A$C*")
       (setq out (cons (strcat "JUNK-XREFBLK|" nm "|bound xref block") out)))
      ((wcmatch nm "TB `- *")
       (setq out (cons (strcat "JUNK-TB|" nm "|legacy title block") out))))
    (setq n (tblnext "BLOCK")))
  (setq n (tblnext "STYLE" T))
  (while n
    (if (wcmatch (strcase (cdr (assoc 2 n))) "PDF *")
      (setq out (cons (strcat "JUNK-PDFSTYLE|" (cdr (assoc 2 n))
                              "|PDF-import text style") out)))
    (setq n (tblnext "STYLE")))
  (reverse out))

;;; ------------------------------------------------------------------
;;;  bts:check-overrides  -  BYOBJECT appearance, aggregated per layer.
;;;  Section 2 rule 2 of the standard: colour, lineweight and plot state
;;;  are ByLayer, always. bts:audit reads the LAYER table and cannot see
;;;  per-object overrides, so this covers the gap - particularly after a
;;;  split, where hatches may carry their own transparency.
;;;  Linetype overrides are counted but NOT reported as deviations: on
;;;  utility runs that override IS the standard.
;;; ------------------------------------------------------------------

(defun bts:check-overrides (/ ss i e lay tal nlt tot)
  (setq tal '() nlt 0 tot 0)
  (if (setq ss (ssget "_X"))
    (progn
      (setq i 0)
      (repeat (sslength ss)
        (setq e   (entget (ssname ss i))
              lay (cdr (assoc 8 e)))
        ;; 62 present and not 256 = colour set by object
        ;; 6  present and not "ByLayer" = linetype set by object
        ;; 370 present and >= 0 = lineweight set by object
        ;; 440 present = transparency set by object
        (if (and (assoc 62 e) (/= (abs (cdr (assoc 62 e))) 256))
          (setq tal (bts:tally (strcat "OVR-COLOUR|" lay) tal)))
        (if (and (assoc 6 e)
                 (not (member (strcase (cdr (assoc 6 e))) '("BYLAYER" "BYBLOCK"))))
          (setq nlt (1+ nlt)))
        (if (and (assoc 370 e) (>= (cdr (assoc 370 e)) 0))
          (setq tal (bts:tally (strcat "OVR-LWEIGHT|" lay) tal)))
        (if (assoc 440 e)
          (setq tal (bts:tally (strcat "OVR-TRANSP|" lay) tal)))
        (setq i (1+ i) tot (1+ tot)))))
  (list (bts:tally->findings tal "object(s)") tot nlt))

;;; ------------------------------------------------------------------
;;;  bts:check-units  -  drawing variables plus a georeferencing sanity
;;;  check. Model geometry is BNG metres; a survey sitting on local
;;;  coordinates is a bigger problem than any layer deviation.
;;; ------------------------------------------------------------------

(defun bts:var-deviations (/ v nm want typ cur bad)
  (foreach v *BTS-VARS*
    (setq nm (nth 0 v) want (nth 1 v) typ (nth 2 v)
          cur (vl-catch-all-apply 'getvar (list nm)))
    (if (not (vl-catch-all-error-p cur))
      (if (if (= typ "str")
            (not (= (strcase (vl-princ-to-string cur)) (strcase want)))
            (not (= cur want)))
        (setq bad (cons (list nm cur want (nth 3 v)) bad)))))
  (reverse bad))

(defun bts:check-units (/ out v mn mx e0 n0 e1 n1)
  (foreach v (bts:var-deviations)
    (setq out (cons (strcat "VAR|" (nth 0 v) "|is "
                            (vl-princ-to-string (nth 1 v)) ", should be "
                            (vl-princ-to-string (nth 2 v))) out)))
  (setq mn (getvar "EXTMIN") mx (getvar "EXTMAX"))
  ;; An empty drawing reports EXTMIN above EXTMAX. Nothing to judge.
  (if (and mn mx (> (car mx) (car mn)))
    (progn
      (setq e0 (nth 0 *BTS-BNG-ENVELOPE*) n0 (nth 1 *BTS-BNG-ENVELOPE*)
            e1 (nth 2 *BTS-BNG-ENVELOPE*) n1 (nth 3 *BTS-BNG-ENVELOPE*))
      (cond
        ((or (< (car mn) e0) (> (car mx) e1)
             (< (cadr mn) n0) (> (cadr mx) n1))
         (setq out (cons (strcat "UNITS-BNG|extents|model extents fall outside"
                                 " the BNG envelope - check the drawing is in"
                                 " BNG metres") out)))
        ((and (< (car mx) 1000.0) (< (cadr mx) 1000.0))
         (setq out (cons (strcat "UNITS-BNG|extents|model sits near the origin"
                                 " - looks like local coordinates, not BNG")
                         out))))))
  (reverse out))

;;; ------------------------------------------------------------------
;;;  bts:check-titleblock  -  every layout carries exactly one title block
;;;  from the register, on BTS-L-PageBlock, with its attributes filled in.
;;; ------------------------------------------------------------------

(defun bts:tb-spec-of (nm / p hit)
  (foreach p *BTS-TITLEBLOCK*
    (if (and (null hit) (wcmatch (strcase nm) (strcase (car p)))) (setq hit p)))
  hit)

(defun bts:check-titleblock (/ out lay ss i e nm spec found tag val atts)
  (foreach lay (bts:get-layouts)
    (setq found 0)
    (if (setq ss (ssget "_X" (list '(0 . "INSERT") (cons 410 lay))))
      (progn
        (setq i 0)
        (repeat (sslength ss)
          (setq e  (entget (ssname ss i))
                nm (cdr (assoc 2 e)))
          (if (setq spec (bts:tb-spec-of nm))
            (progn
              (setq found (1+ found)
                    atts  (bts:attribs-of (ssname ss i)))
              (if (/= (strcase (cdr (assoc 8 e))) "BTS-L-PAGEBLOCK")
                (setq out (cons (strcat "TB-LAYER|" lay "|" nm " is on "
                                        (cdr (assoc 8 e))
                                        ", should be BTS-L-PageBlock") out)))
              (foreach tag (cadr spec)
                (setq val (cdr (assoc (strcase tag) atts)))
                (cond
                  ((null val)
                   (setq out (cons (strcat "TB-ATTR|" lay "|" nm
                                           " has no attribute " tag) out)))
                  ((= "" (bts:trim val))
                   (setq out (cons (strcat "TB-ATTR|" lay "|" tag
                                           " is empty") out)))))))
          (setq i (1+ i)))))
    (cond
      ((zerop found)
       (setq out (cons (strcat "TB-NONE|" lay
                               "|no title block from the register") out)))
      ((> found 1)
       (setq out (cons (strcat "TB-DUP|" lay "|" (itoa found)
                               " title blocks on one layout") out)))))
  (reverse out))

(defun bts:trim (s)
  (while (and (> (strlen s) 0) (= " " (substr s 1 1)))
    (setq s (substr s 2)))
  (while (and (> (strlen s) 0) (= " " (substr s (strlen s) 1)))
    (setq s (substr s 1 (1- (strlen s)))))
  s)

;;; ------------------------------------------------------------------
;;;  bts:check-viewports  -  viewports plot at a standard scale, sit on a
;;;  viewport layer, and are locked so a stray zoom cannot rescale them.
;;; ------------------------------------------------------------------

(defun bts:check-viewports (/ out vp lay den best d who)
  (foreach vp (bts:scan-viewport)
    (setq lay (nth 2 vp) den (nth 4 vp)
          who (strcat (nth 0 vp) " " (cond ((nth 1 vp)) (t "?"))))
    (if (not (member (strcase lay) '("BTS-L-VPORT" "BTS-L-VPORTNONPLOT")))
      (setq out (cons (strcat "VP-LAYER|" who "|viewport is on " lay
                              ", should be BTS-L-VPort or BTS-L-VPortNonPlot")
                      out)))
    (if (null (nth 3 vp))
      (setq out (cons (strcat "VP-UNLOCKED|" who
                              "|display is not locked") out)))
    (if (> den 0.0)
      (progn
        (setq best nil)
        (foreach d *BTS-VP-SCALES*
          (if (< (abs (- den d)) (* 0.005 d)) (setq best d)))
        (if (null best)
          (setq out (cons (strcat "VP-SCALE|" who "|1:"
                                  (rtos den 2 1)
                                  " is not a standard plot scale") out))))))
  (reverse out))

;;; ------------------------------------------------------------------
;;;  bts:check-xrefs  -  an xref that cannot be resolved will plot as a
;;;  hole in the sheet. Cheapest possible check, highest possible cost.
;;; ------------------------------------------------------------------

(defun bts:resolve-xref (p / r)
  (setq r (vl-string-translate "\\" "/" p))
  (cond
    ((findfile r))
    ((= "//" (substr r 1 2)) nil)                       ; UNC, already absolute
    ((vl-string-search ":" r) nil)                      ; drive letter, absolute
    ((= "./" (substr r 1 2))
     (findfile (strcat (getvar "DWGPREFIX") (substr r 3))))
    (t (findfile (strcat (getvar "DWGPREFIX") r)))))

(defun bts:check-xrefs (/ out b)
  (foreach b (bts:get-blocks)
    (if (and (cadr b) (/= "" (caddr b)) (null (bts:resolve-xref (caddr b))))
      (setq out (cons (strcat "XREF-MISSING|" (car b) "|cannot resolve "
                              (caddr b)) out))))
  (reverse out))

;;; ------------------------------------------------------------------
;;;  bts:report-writer  -  SECTIONS is a list of (heading . findings).
;;;  Findings are formatted; a heading with no findings still prints, so
;;;  a clean section is visibly clean rather than absent.
;;; ------------------------------------------------------------------

(defun bts:report-writer (path title sections / f sec bad i)
  (if (setq f (open path "w"))
    (progn
      (write-line (strcat "BTS " *BTS-STD-VERSION*) f)
      (write-line title f)
      (write-line (strcat "Drawing  : " (bts:dwg-path)) f)
      (write-line (strcat "CDATE    : " (rtos (getvar "CDATE") 2 6)
                          "  (YYYYMMDD.HHMMSS)") f)
      (write-line "" f)
      (foreach sec sections
        (write-line (car sec) f)
        (write-line "--------------------------------------------------------------" f)
        (if (null (cdr sec))
          (write-line "  none" f)
          (foreach i (cdr sec) (write-line (strcat "  " (bts:fmt i)) f)))
        (write-line "" f))
      (setq bad (bts:faults (apply 'append (mapcar 'cdr sections))))
      (write-line (strcat (itoa (length bad)) " deviation(s).  Compliance score "
                          (itoa (bts:score bad)) "/100.") f)
      (close f)
      path)))

;;; ------------------------------------------------------------------
;;;  Help register. Modules append to it as they load.
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

(defun bts:help-add (rows)
  (setq *BTS-HELP* (append *BTS-HELP* rows)))

;;; ------------------------------------------------------------------
;;;  Commands
;;; ------------------------------------------------------------------

(defun C:BTSCHECK (/ iss i)
  (setq iss (bts:audit))
  (bts:say (strcat "BTS " *BTS-STD-VERSION* " - audit of " (getvar "DWGNAME")))
  (bts:say "--------------------------------------------------------------")
  (if (null iss)
    (bts:say "  No deviations found.")
    (foreach i iss (bts:say (strcat "  " (bts:fmt i)))))
  (bts:say "--------------------------------------------------------------")
  (bts:say (strcat "  " (itoa (length iss)) " deviation(s).  Score "
                   (itoa (bts:score iss)) "/100."))
  (bts:say "  BTSFIX corrects properties.  BTSREMAP clears legacy layers.")
  (princ))

(defun C:BTSFIX (/ *error* res)

  ;; No (command) calls in this function, so the error handler must not
  ;; make one either - see *push-error-using-command* in the AutoLISP docs.
  (defun *error* (m)
    (princ (strcat "\nBTSFIX stopped.\n  " m))
    (princ))

  (bts:say "Applying the BTS layer register ...")
  (setq res (bts:fix))
  (bts:say (strcat "Done. " (itoa (car res)) " layer(s) created, "
                   (itoa (cdr res)) " updated."))
  (bts:say "Run BTSCHECK to confirm, then BTSREMAP for the LEGACY entries.")
  (princ))

;;; Scripted equivalent of LAYMRG. LAYMRG's Name option opens a dialog,
;;; so it cannot be automated; bts:remap-all walks the database instead.
;;; Covers model space, all layouts, and block definitions.
(defun C:BTSREMAP (/ *error* ce res nm l)

  ;; bts:remap-all does call -PURGE, so the error handler is permitted to
  ;; cancel it - but only after *push-error-using-command*.
  (defun *error* (m)
    (if *pop-error-mode* (*pop-error-mode*))
    (if ce (setvar "CMDECHO" ce))
    (princ (strcat "\nBTSREMAP stopped.\n  " m))
    (princ))

  (setq ce (getvar "CMDECHO"))
  (setvar "CMDECHO" 0)
  (bts:say "Remapping legacy layers ...")
  (setq res (bts:remap-all))
  (foreach l (bts:res "lines" res) (bts:say l))

  (if *push-error-using-command* (*push-error-using-command*))
  (command "_.REGENALL")
  (if *pop-error-mode* (*pop-error-mode*))
  (setvar "CMDECHO" ce)

  (bts:say (strcat "Done. " (itoa (bts:res "moved" res)) " object(s) moved, "
                   (itoa (bts:res "purged" res)) " legacy layer(s) purged."))
  (if (> (bts:res "split" res) 0)
    (progn
      (bts:say (strcat "  " (itoa (bts:res "split" res))
                       " layer(s) were split into boundary and fill."))
      (bts:say "  Check for BYOBJECT colour or transparency on the moved")
      (bts:say "  hatches - QSELECT, or run BTSOVERRIDE.")))
  (if (> (bts:res "review" res) 0)
    (bts:say (strcat "  " (itoa (bts:res "review" res))
                     " layer(s) need a manual decision - run BTSCHECK and see REVIEW.")))
  (if (bts:res "left" res)
    (progn
      (bts:say (strcat "  " (itoa (length (bts:res "left" res)))
                       " layer(s) are not in the standard and have no remap:"))
      (foreach nm (bts:res "left" res) (bts:say (strcat "     " nm)))
      (bts:say "  Add them to *BTS-REMAP*, or move the objects by hand.")))
  (princ))

(defun C:BTSVARS (/ bad v ans)
  (setq bad (bts:var-deviations))
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

(defun C:BTSJUNK (/ hits i)
  (setq hits (bts:cleanup))
  (bts:say "Housekeeping scan")
  (bts:say "--------------------------------------------------------------")
  (if (null hits)
    (bts:say "  Nothing found.")
    (foreach i hits (bts:say (strcat "  " (bts:fmt i)))))
  (bts:say "--------------------------------------------------------------")
  (bts:say (strcat "  " (itoa (length hits))
                   " item(s). Review before PURGE - some may be in use."))
  (princ))

(defun C:BTSOVERRIDE (/ res iss i)
  (setq res (bts:check-overrides) iss (nth 0 res))
  (bts:say (strcat "BYOBJECT override scan - " (itoa (nth 1 res))
                   " object(s) examined"))
  (bts:say "--------------------------------------------------------------")
  (if (null iss)
    (bts:say "  No colour, lineweight or transparency overrides found.")
    (foreach i iss (bts:say (strcat "  " (bts:fmt i)))))
  (bts:say (strcat "  linetype overrides  " (itoa (nth 2 res))
                   "   (expected: utility runs - see standard section 3)"))
  (bts:say "--------------------------------------------------------------")
  (if iss
    (progn
      (bts:say "  To clear: QSELECT the objects, then set Colour, Lineweight")
      (bts:say "  and Transparency to ByLayer in Properties. Leave LINETYPE")
      (bts:say "  alone on utility runs - that override is the standard.")))
  (princ))

(defun C:BTSREPORT (/ p fn iss)
  (setq p (getvar "DWGPREFIX"))
  (if (= p "") (setq p (getvar "TEMPPREFIX")))
  (setq fn  (strcat p (vl-filename-base (getvar "DWGNAME")) "_BTSCheck.txt")
        iss (bts:audit))
  (if (bts:report-writer fn "Standards report"
        (list (cons "LAYER AUDIT" iss)))
    (bts:say (strcat "Report written: " fn))
    (bts:say "Could not write report - check folder permissions."))
  (princ))

(defun C:BTSHELP (/ row)
  (bts:say (strcat "BTS " *BTS-STD-VERSION* " - commands"))
  (bts:say "--------------------------------------------------------------")
  (foreach row *BTS-HELP*
    (bts:say (strcat "  " (bts:pad (car row) 18) (cadr row))))
  (bts:say "--------------------------------------------------------------")
  (bts:say "  Usual order on an inherited drawing:")
  (bts:say "    BTSCHECK -> BTSFIX -> BTSREMAP -> BTSOVERRIDE -> BTSJUNK -> BTSREPORT")
  (bts:say "  Read-only: BTSCHECK BTSJUNK BTSOVERRIDE BTSREPORT BTSQLCHECK BTSTEXTCHECK")
  (bts:say "  BTSFIX and BTSREMAP modify the drawing - work on a copy first.")
  (princ))

(princ)
