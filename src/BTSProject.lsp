;;; ==================================================================
;;;  BTSProject.lsp
;;;  BTS Enterprise Standards Suite - enterprise layer
;;;
;;;  BTSCOMPLETECHECK   every check in the suite, one report
;;;  BTSPROJECTAUDIT    the same, across a project tree
;;;  BTSPROJECTREPORT   roll a batch log up into a management summary
;;;  BTSPACKAGE         issue readiness, manifest and transmittal script
;;; ==================================================================

;;; ---- Named transmittal setup BTSPACKAGE drives. Create it once per
;;;      machine in ETRANSMIT > Transmittal Setups, then never again.
(setq *BTS-TRANSMITTAL-SETUP* "BTS-Issue")
(setq *BTS-PACKAGE-ISSUE* "BTS-Issue")

;;; ------------------------------------------------------------------
;;;  bts:complete-findings  -  every engine in the suite, in one list.
;;;  Modules that are not loaded are skipped rather than erroring, so a
;;;  partial install still produces a usable report.
;;; ------------------------------------------------------------------

(defun bts:complete-findings (/ out)
  (setq out (append (bts:audit)
                    (bts:check-units)
                    (bts:check-xrefs)
                    (bts:check-titleblock)
                    (bts:check-viewports)
                    (car (bts:check-overrides))
                    (bts:cleanup)))
  (if bts:check-ql   (setq out (append out (bts:check-ql))))
  (if bts:check-text (setq out (append out (bts:check-text))))
  out)

(defun bts:complete-sections ()
  (list (cons "LAYER REGISTER"      (bts:audit))
        (cons "UNITS AND VARIABLES" (bts:check-units))
        (cons "EXTERNAL REFERENCES" (bts:check-xrefs))
        (cons "TITLE BLOCKS"        (bts:check-titleblock))
        (cons "VIEWPORTS"           (bts:check-viewports))
        (cons "BYOBJECT OVERRIDES"  (car (bts:check-overrides)))
        (cons "QUALITY LEVELS"      (if bts:check-ql (bts:check-ql)))
        (cons "TEXT"                (if bts:check-text (bts:check-text)))
        (cons "TEMPLATE RESIDUE"    (bts:cleanup))))

(defun C:BTSCOMPLETECHECK (/ secs all p fn sec i)
  (setq secs (bts:complete-sections)
        all  (bts:faults (apply 'append (mapcar 'cdr secs))))
  (bts:say (strcat "BTS complete check - " (getvar "DWGNAME")))
  (foreach sec secs
    (bts:say "")
    (bts:say (car sec))
    (bts:say "--------------------------------------------------------------")
    (if (null (cdr sec))
      (bts:say "  none")
      (foreach i (cdr sec) (bts:say (strcat "  " (bts:fmt i))))))
  (bts:say "")
  (bts:say "--------------------------------------------------------------")
  (bts:say (strcat "  " (itoa (length all)) " deviation(s).  Compliance score "
                   (itoa (bts:score all)) "/100."))
  (setq p (getvar "DWGPREFIX"))
  (if (= p "") (setq p (getvar "TEMPPREFIX")))
  (setq fn (strcat p (vl-filename-base (getvar "DWGNAME")) "_BTSComplete.txt"))
  (if (bts:report-writer fn "Complete standards validation" secs)
    (bts:say (strcat "  Report written: " fn)))
  (princ))

;;; ------------------------------------------------------------------
;;;  BTSPROJECTAUDIT  -  batch FULL across a whole project tree.
;;; ------------------------------------------------------------------

(defun C:BTSPROJECTAUDIT ()
  (setq *BTS-BATCH-RECURSE* T)
  (bts:say "Project audit - every drawing in the folder AND its subfolders.")
  (bts:say "  Read only. Nothing is saved.")
  (bts:batch-go "BTSPROJECTAUDIT" "FULL" nil 'report)
  (setq *BTS-BATCH-RECURSE* nil)
  (princ))

;;; ------------------------------------------------------------------
;;;  bts:log->report  -  turn a batch log into a management summary.
;;;  Runs as the tail line of a generated script, or on demand through
;;;  BTSPROJECTREPORT.
;;; ------------------------------------------------------------------

(defun bts:sort-worst (lst / out best x)
  (while lst
    (setq best (car lst))
    (foreach x (cdr lst) (if (< (caddr x) (caddr best)) (setq best x)))
    (setq out (cons best out) lst (vl-remove best lst)))
  (reverse out))

(defun bts:log-parse (log / f line p q dwgs bycode errs)
  (setq dwgs '() bycode '() errs '())
  (if (setq f (open log "r"))
    (progn
      (while (setq line (read-line f))
        (setq p (bts:split line))
        (cond
          ((= (nth 0 p) "SUM")
           (setq q    (bts:split (nth 2 p))
                 dwgs (cons (list (nth 1 p) (atoi (nth 0 q)) (atoi (nth 1 q)))
                            dwgs)))
          ((= (nth 0 p) "ERR")
           (setq errs (cons (strcat (nth 1 p) " - " (nth 2 p)) errs)))
          ((member (nth 0 p) '("DWG" "INFO" "META" "BTS")) nil)
          ((= "" (nth 1 p)) nil)
          (t (setq bycode (bts:tally (bts:code-root (nth 0 p)) bycode)))))
      (close f)))
  (list (reverse dwgs) (reverse bycode) (reverse errs)))

(defun bts:log->report (log / parsed dwgs bycode errs f out n tot mean worst
                          i p)
  (setq parsed (bts:log-parse log)
        dwgs   (nth 0 parsed)
        bycode (nth 1 parsed)
        errs   (nth 2 parsed)
        out    (strcat (vl-filename-directory log) "/"
                       (vl-filename-base log) "_Summary.txt")
        n      (length dwgs)
        tot    0)
  (foreach p dwgs (setq tot (+ tot (cadr p))))
  (setq mean 0)
  (foreach p dwgs (setq mean (+ mean (caddr p))))
  (setq mean  (if (> n 0) (/ mean n) 0)
        worst (bts:sort-worst dwgs))
  (if (setq f (open out "w"))
    (progn
      (write-line (strcat "BTS " *BTS-STD-VERSION*) f)
      (write-line "Project compliance summary" f)
      (write-line (strcat "Source log : " log) f)
      (write-line (strcat "CDATE      : " (rtos (getvar "CDATE") 2 6)) f)
      (write-line "" f)
      (write-line (strcat "Drawings processed : " (itoa n)) f)
      (write-line (strcat "Total deviations   : " (itoa tot)) f)
      (write-line (strcat "Mean score         : " (itoa mean) "/100") f)
      (write-line "" f)
      (write-line "DEVIATIONS BY TYPE" f)
      (write-line "--------------------------------------------------------------" f)
      (if (null bycode)
        (write-line "  none" f)
        (foreach p bycode
          (write-line (strcat "  " (bts:pad (car p) 14) (itoa (cdr p))) f)))
      (write-line "" f)
      (write-line "LOWEST SCORING DRAWINGS" f)
      (write-line "--------------------------------------------------------------" f)
      (setq i 0)
      (foreach p worst
        (if (< i 20)
          (progn
            (write-line (strcat "  " (bts:pad (itoa (caddr p)) 6)
                                (bts:pad (strcat (itoa (cadr p)) " dev") 10)
                                (car p)) f)
            (setq i (1+ i)))))
      (write-line "" f)
      (write-line "DRAWINGS THAT DID NOT PROCESS CLEANLY" f)
      (write-line "--------------------------------------------------------------" f)
      (if (null errs)
        (write-line "  none" f)
        (foreach p errs (write-line (strcat "  " p) f)))
      (close f)
      (bts:say (strcat "\nProject summary written: " out))))
  out)

(defun C:BTSPROJECTREPORT (/ log)
  (if (setq log (getfiled "Pick the BTS batch log to roll up"
                          (getvar "DWGPREFIX") "txt" 0))
    (bts:log->report log)
    (bts:say "Cancelled."))
  (princ))

;;; ------------------------------------------------------------------
;;;  BTSPACKAGE  -  issue readiness, then a manifest and a transmittal
;;;  script. Nothing is copied here: eTransmit is the only thing that
;;;  resolves and rebases xref paths correctly, so the script drives it.
;;; ------------------------------------------------------------------

;;; A DRAFT watermark that is still thawed and plotting is the single most
;;; expensive thing to get wrong on an issue.
(defun bts:check-issue (/ out e flags)
  (setq out (append (bts:check-xrefs) (bts:check-titleblock)))
  (if (setq e (bts:lay-ent "BTS-L-Draft"))
    (progn
      (setq flags (cdr (assoc 70 (entget e))))
      (if (and (zerop (logand flags 1))                      ; not frozen
               (> (cdr (assoc 62 (entget e))) 0)             ; not off
               (> (bts:count-on-layer "BTS-L-Draft") 0))
        (setq out (cons (strcat "ISSUE-DRAFT|BTS-L-Draft|watermark is thawed,"
                                " on, and holds objects") out)))))
  (setq out (append out (bts:issue-meta)))
  out)

;;; Pull the drawing number and revision out of the first title block we
;;; recognise, so the manifest can be assembled without opening anything
;;; a second time.
(defun bts:issue-meta (/ lay ss i e nm atts num rev)
  (foreach lay (bts:get-layouts)
    (if (setq ss (ssget "_X" (list '(0 . "INSERT") (cons 410 lay))))
      (progn
        (setq i 0)
        (repeat (sslength ss)
          (setq e  (entget (ssname ss i))
                nm (cdr (assoc 2 e)))
          (if (and (null num) (bts:tb-spec-of nm))
            (setq atts (bts:attribs-of (ssname ss i))
                  num  (cond ((cdr (assoc "DRAWINGNUMBER" atts))) (t "?"))
                  rev  (cond ((cdr (assoc "REVISION" atts))) (t "?"))))
          (setq i (1+ i))))))
  (list (strcat "META|" (bts:dwg-path) "|"
                (cond (num) (t "no title block")) " rev "
                (cond (rev) (t "?")))))

(defun bts:package-manifest (log issue / parsed dwgs errs f dir out scr line
                               p meta)
  (setq dir  (bts:dir-norm (vl-filename-directory log))
        out  (strcat dir issue "_Manifest.txt")
        scr  (strcat dir issue "_Transmit.scr")
        meta '())
  ;; META lines are the only thing the manifest needs from the log, and
  ;; bts:log-parse throws them away, so read them back here.
  (if (setq f (open log "r"))
    (progn
      (while (setq line (read-line f))
        (setq p (bts:split line))
        (if (= (nth 0 p) "META")
          (setq meta (cons (cons (nth 1 p) (nth 2 p)) meta))))
      (close f)))
  (setq meta   (reverse meta)
        parsed (bts:log-parse log)
        dwgs   (nth 0 parsed)
        errs   (nth 2 parsed))

  (if (setq f (open out "w"))
    (progn
      (write-line (strcat "BTS " *BTS-STD-VERSION*) f)
      (write-line (strcat "Issue package manifest - " issue) f)
      (write-line (strcat "CDATE : " (rtos (getvar "CDATE") 2 6)) f)
      (write-line "" f)
      (write-line "DRAWINGS" f)
      (write-line "--------------------------------------------------------------" f)
      (foreach p meta
        (write-line (strcat "  " (bts:pad (cdr p) 28) (car p)) f))
      (write-line "" f)
      (write-line "NOT READY TO ISSUE" f)
      (write-line "--------------------------------------------------------------" f)
      (setq line nil)
      (foreach p dwgs
        (if (> (cadr p) 0)
          (progn (write-line (strcat "  " (bts:pad (itoa (cadr p)) 6) (car p)) f)
                 (setq line T))))
      (if (null line) (write-line "  none - every drawing is clean" f))
      (write-line "" f)
      (if errs
        (progn
          (write-line "DID NOT PROCESS" f)
          (write-line "--------------------------------------------------------------" f)
          (foreach p errs (write-line (strcat "  " p) f))))
      (close f)))

  ;; The transmittal script needs a saved setup to point at; -ETRANSMIT
  ;; cannot define one from the command line.
  (if (setq f (open scr "w"))
    (progn
      (write-line (strcat "; BTS issue package - " issue) f)
      (write-line (strcat "; Requires a transmittal setup named "
                          *BTS-TRANSMITTAL-SETUP*) f)
      (write-line "; ETRANSMIT > Transmittal Setups > New, once per machine." f)
      (write-line "(setvar \"FILEDIA\" 0)" f)
      (foreach p dwgs
        (write-line (strcat "_.OPEN \"" (vl-string-translate "\\" "/" (car p))
                            "\"") f)
        (write-line (strcat "-ETRANSMIT _C " *BTS-TRANSMITTAL-SETUP*) f)
        (write-line "(if (zerop (getvar \"DBMOD\")) (command \"_.CLOSE\") (command \"_.CLOSE\" \"_N\"))" f))
      (write-line "(setvar \"FILEDIA\" 1)" f)
      (close f)))

  (bts:say (strcat "\nManifest  : " out))
  (bts:say (strcat "Transmit  : " scr))
  (bts:say "Check the manifest before running the transmittal script.")
  out)

(defun C:BTSPACKAGE (/ issue)
  (setq *BTS-BATCH-RECURSE* T)
  (bts:say "Issue package - checks readiness, then builds a manifest.")
  (setq issue (getstring T "\nIssue reference (e.g. C1234-S4-P01): "))
  (if (= issue "") (setq issue "BTS-Issue"))
  (setq *BTS-PACKAGE-ISSUE* issue)
  (bts:batch-go "BTSPACKAGE" "ISSUE" nil 'package)
  (setq *BTS-BATCH-RECURSE* nil)
  (princ))

(bts:help-add '(
  ("BTSCOMPLETECHECK"  "Every check in the suite against this drawing.")
  ("BTSPROJECTAUDIT"   "Complete check across a folder and its subfolders.")
  ("BTSPROJECTREPORT"  "Roll a batch log up into a management summary.")
  ("BTSPACKAGE"        "Issue readiness, manifest and transmittal script.")
))

(princ)
