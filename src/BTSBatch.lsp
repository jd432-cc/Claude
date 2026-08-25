;;; ==================================================================
;;;  BTSBatch.lsp
;;;  BTS Enterprise Standards Suite - CAD manager batch layer
;;;
;;;  WHY THIS IS BUILT ON SCRIPTS
;;;  The usual way to touch many drawings from LISP is ObjectDBX -
;;;  (vlax-get-or-create-object "ObjectDBX.AxDbDocument") - which opens a
;;;  drawing in memory without a window. AutoCAD LT does not ship
;;;  ObjectDBX, or ObjectARX, or VBA, so that route does not exist here.
;;;
;;;  So a batch command does not process anything itself. It enumerates
;;;  the folder, writes a .scr that opens each drawing in turn and calls
;;;  bts:batch-run inside it, and offers to launch it. Every drawing
;;;  appends to one shared log, which BTSPROJECTREPORT rolls up.
;;;
;;;  Consequences worth knowing before you run one:
;;;    - Close every other drawing first. The script opens and closes
;;;      documents; a second open drawing confuses the return path.
;;;    - The drawing you launch from is excluded from the run. Closing it
;;;      would kill the script with it.
;;;    - A drawing that is open elsewhere on the network opens read-only.
;;;      Write modes log it as skipped rather than failing the run.
;;;
;;;  COMMANDS
;;;    BTSBATCHCHECK   audit every drawing in a folder
;;;    BTSBATCHFIX     create + correct layers in every drawing
;;;    BTSBATCHREMAP   clear legacy layers in every drawing
;;;    BTSBATCHVARS    check, optionally set, drawing variables
;;;    BTSBATCHJUNK    template residue across a folder
;;;    BTSBATCHREPORT  full check of every drawing into one .txt
;;; ==================================================================

;;; ---- Where the suite lives on disk. The generated script has to load
;;;      it again inside every drawing it opens, because each document
;;;      gets its own AutoLISP environment.
(defun bts:home (/ p)
  (cond
    ((and *BTS-HOME* (findfile (strcat *BTS-HOME* "BTSEnterprise.lsp")))
     *BTS-HOME*)
    ((setq p (findfile "BTSEnterprise.lsp"))
     (setq *BTS-HOME* (bts:dir-norm (vl-filename-directory p))))
    (t nil)))

;;; ---- Folder enumeration. RECURSE non-nil walks subfolders.
(defun bts:batch-folder-scan (dir recurse / out f s)
  (setq dir (bts:dir-norm dir))
  (foreach f (vl-directory-files dir "*.dwg" 1)
    (setq out (cons (strcat dir f) out)))
  (if recurse
    (foreach s (vl-directory-files dir nil -1)
      (if (not (member s '("." "..")))
        (setq out (append (reverse (bts:batch-folder-scan
                                     (strcat dir s "/") T))
                          out)))))
  (reverse out))

(defun bts:pick-folder (prompt / p)
  (if (setq p (getfiled prompt (getvar "DWGPREFIX") "dwg" 0))
    (bts:dir-norm (vl-filename-directory p))))

;;; The launching drawing must survive the run - the script is executing
;;; inside it, and closing it takes the script down too.
(defun bts:batch-exclude-current (files / here out f)
  (setq here (strcase (bts:dir-norm (getvar "DWGPREFIX"))))
  (setq here (strcat here (strcase (getvar "DWGNAME"))))
  (foreach f files
    (if (/= (strcase (vl-string-translate "\\" "/" f)) here)
      (setq out (cons f out))))
  (reverse out))

;;; ------------------------------------------------------------------
;;;  bts:batch-run  -  the per-drawing entry point. Called by the
;;;  generated script from inside each opened drawing, and it closes the
;;;  drawing on the way out so the script can move to the next one.
;;; ------------------------------------------------------------------

(defun bts:batch-log (log line / f)
  (if (setq f (open log "a"))
    (progn (write-line line f) (close f))))

(defun bts:batch-findings (mode / iss res v)
  (cond
    ((= mode "CHECK") (bts:audit))
    ((= mode "FIX")
     (setq res (bts:fix))
     (cons (strcat "INFO|fix|" (itoa (car res)) " created, "
                   (itoa (cdr res)) " updated")
           (bts:audit)))
    ((= mode "REMAP") (bts:batch-remap-findings nil))
    ((= mode "FIXREMAP") (bts:batch-remap-findings T))
    ((= mode "VARS") (bts:check-units))
    ((= mode "VARSFIX")
     (setq iss (bts:check-units))
     (foreach v (bts:var-deviations)
       (vl-catch-all-apply 'setvar (list (nth 0 v) (nth 2 v))))
     iss)
    ((= mode "JUNK") (bts:cleanup))
    ((= mode "FULL") (bts:complete-findings))
    ((= mode "ISSUE") (bts:check-issue))
    (t (list (strcat "ERR|mode|unknown batch mode " mode)))))

(defun bts:batch-remap-findings (dofix / res out nm)
  (if dofix (bts:fix))
  (setq res (bts:remap-all)
        out (list (strcat "INFO|remap|" (itoa (bts:res "moved" res))
                          " object(s) moved, " (itoa (bts:res "purged" res))
                          " layer(s) purged")))
  (foreach nm (bts:res "left" res)
    (setq out (cons (strcat "NONSTD|" nm "|no remap defined") out)))
  (reverse out))

(defun bts:batch-run (mode log save / iss path caught i faults)
  (setq path (bts:dwg-path))
  (bts:batch-log log (strcat "DWG|" path))
  (setq caught (vl-catch-all-apply 'bts:batch-findings (list mode)))
  (if (vl-catch-all-error-p caught)
    (progn
      (setq iss (list (strcat "ERR|" path "|"
                              (vl-catch-all-error-message caught))))
      (setq save nil))
    (setq iss caught))
  (foreach i iss (bts:batch-log log i))
  (setq faults (bts:faults iss))
  (bts:batch-log log (strcat "SUM|" path "|" (itoa (length faults)) "|"
                             (itoa (bts:score faults))))
  (bts:batch-finish log path save)
  (princ))

;;; WRITESTAT is 0 when the drawing opened read-only - somebody else has
;;; it, or the file is marked read-only on disk. Saving would fail and
;;; take the whole script down, so log it and move on.
(defun bts:batch-finish (log path save)
  (setvar "FILEDIA" 0)
  (if save
    (if (= 1 (getvar "WRITESTAT"))
      (command "_.QSAVE")
      (bts:batch-log log (strcat "ERR|" path
                                 "|opened read-only, changes not saved"))))
  (if (zerop (getvar "DBMOD"))
    (command "_.CLOSE")
    (command "_.CLOSE" "_N")))

;;; ------------------------------------------------------------------
;;;  Script generation
;;; ------------------------------------------------------------------

(defun bts:batch-write-script (files mode log scr save tail / f home p)
  (if (null (setq home (bts:home)))
    nil
    (if (setq f (open scr "w"))
      (progn
        (write-line "; Generated by the BTS Enterprise Standards Suite." f)
        (write-line "; Do not edit. Re-run the batch command to regenerate." f)
        (write-line "(setvar \"FILEDIA\" 0)" f)
        (write-line "(setvar \"CMDECHO\" 0)" f)
        (foreach p files
          (write-line (strcat "_.OPEN \"" p "\"") f)
          (write-line (strcat "(setq *BTS-HOME* \"" home "\")") f)
          (write-line (strcat "(if (null bts:batch-run) (load \"" home
                              "BTSLoad.lsp\"))") f)
          (write-line (strcat "(bts:batch-run \"" mode "\" \"" log "\" "
                              (if save "T" "nil") ")") f))
        (if tail (write-line tail f))
        (write-line "(setvar \"FILEDIA\" 1)" f)
        (write-line "(princ \"\\nBTS batch run complete.\")" f)
        (close f)
        scr))))

;;; Common driver. Returns nothing useful; it prints and optionally runs.
(defun bts:batch-go (label mode save tail / dir files log scr ans stamp)
  (if (null (bts:home))
    (progn
      (bts:say "BTSBATCH: cannot locate BTSEnterprise.lsp.")
      (bts:say "  Add the suite folder to Options > Files > Support File")
      (bts:say "  Search Path, then reload."))
    (if (setq dir (bts:pick-folder
                    (strcat label " - pick ANY file in the target folder")))
      (progn
        (setq files (bts:batch-exclude-current
                      (bts:batch-folder-scan dir *BTS-BATCH-RECURSE*)))
        (if (null files)
          (bts:say (strcat "  No drawings to process in " dir))
          (progn
            (setq stamp (vl-string-subst "-" "." (rtos (getvar "CDATE") 2 6))
                  log   (strcat dir "_BTS_" mode "_" stamp ".txt")
                  scr   (strcat dir "_BTS_" mode "_" stamp ".scr"))
            (bts:batch-log log
              (strcat "BTS " *BTS-STD-VERSION* " - batch " mode " - " dir))
            (if (bts:batch-write-script files mode log scr save
                  (cond
                    ((eq tail 'report)
                     (strcat "(bts:log->report \"" log "\")"))
                    ((eq tail 'package)
                     (strcat "(bts:package-manifest \"" log "\" \""
                             *BTS-PACKAGE-ISSUE* "\")"))
                    (t nil)))
              (progn
                (bts:say (strcat "  " (itoa (length files))
                                 " drawing(s) queued."))
                (bts:say (strcat "  Script : " scr))
                (bts:say (strcat "  Log    : " log))
                (if save
                  (bts:say "  This mode SAVES each drawing. Back the folder up first."))
                (bts:say "  Close every other drawing before running.")
                (initget "Yes No")
                (setq ans (getkword "\nRun it now? [Yes/No] <No>: "))
                (if (= ans "Yes")
                  (command "_.SCRIPT" scr)
                  (bts:say "  Not run. SCRIPT it when you are ready.")))
              (bts:say "  Could not write the script - check folder permissions.")))))))
  (princ))

;;; Set by BTSPROJECTAUDIT to walk subfolders; folder commands stay flat.
(setq *BTS-BATCH-RECURSE* nil)

;;; ------------------------------------------------------------------
;;;  Commands
;;; ------------------------------------------------------------------

(defun C:BTSBATCHCHECK ()
  (setq *BTS-BATCH-RECURSE* nil)
  (bts:say "Batch audit - read only, nothing is saved.")
  (bts:batch-go "BTSBATCHCHECK" "CHECK" nil nil))

(defun C:BTSBATCHFIX ()
  (setq *BTS-BATCH-RECURSE* nil)
  (bts:say "Batch standards repair - each drawing is SAVED.")
  (bts:batch-go "BTSBATCHFIX" "FIX" T nil))

(defun C:BTSBATCHREMAP (/ ans)
  (setq *BTS-BATCH-RECURSE* nil)
  (bts:say "Batch legacy remap - each drawing is SAVED.")
  (bts:say "  A remap SKIPS any layer whose target does not exist yet, so")
  (bts:say "  BTSFIX normally runs first in each drawing.")
  (initget "Yes No")
  (setq ans (getkword "\nRun BTSFIX first in each drawing? [Yes/No] <Yes>: "))
  (bts:batch-go "BTSBATCHREMAP" (if (= ans "No") "REMAP" "FIXREMAP") T nil))

(defun C:BTSBATCHVARS (/ ans)
  (setq *BTS-BATCH-RECURSE* nil)
  (initget "Yes No")
  (setq ans (getkword "\nSet the variables, or report only? [Yes/No] <No>: "))
  (if (= ans "Yes")
    (progn (bts:say "Batch variable fix - each drawing is SAVED.")
           (bts:batch-go "BTSBATCHVARS" "VARSFIX" T nil))
    (progn (bts:say "Batch variable audit - read only.")
           (bts:batch-go "BTSBATCHVARS" "VARS" nil nil))))

(defun C:BTSBATCHJUNK ()
  (setq *BTS-BATCH-RECURSE* nil)
  (bts:say "Batch housekeeping scan - read only, purges nothing.")
  (bts:batch-go "BTSBATCHJUNK" "JUNK" nil nil))

(defun C:BTSBATCHREPORT ()
  (setq *BTS-BATCH-RECURSE* nil)
  (bts:say "Batch full check - read only. One report for the whole folder.")
  (bts:batch-go "BTSBATCHREPORT" "FULL" nil 'report))

(bts:help-add '(
  ("BTSBATCHCHECK"  "Audit every drawing in a folder. Read only.")
  ("BTSBATCHFIX"    "Create and correct layers in every drawing. Saves.")
  ("BTSBATCHREMAP"  "Clear legacy layers in every drawing. Saves.")
  ("BTSBATCHVARS"   "Check, and optionally set, variables across a folder.")
  ("BTSBATCHJUNK"   "Template residue across a folder. Read only.")
  ("BTSBATCHREPORT" "Full check of a folder, rolled into one .txt.")
))

(princ)
